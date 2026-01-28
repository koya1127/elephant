#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <RtcDS3231.h>
#include <RotaryEncoder.h>
#include <Adafruit_NeoPixel.h>

// ===== ESP-NOW LR (Broadcast) =====
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

#include <math.h>
#include <string.h>

/* =====================================================
   WiFi / ESP-NOW
   ===================================================== */
#define WIFI_CH 1   // ★ 明示的にCH=1（後で変更しやすいように）

/* =====================================================
   Pin map (XIAO ESP32S3)
   ===================================================== */
#define I2C_SDA    D4
#define I2C_SCL    D5
#define ENC_A      D2
#define ENC_B      D1
#define ENC_SW     D3
#define BTN_START  D8
#define BTN_STOP   D9
#define BUZZER_PIN D10
#define NEO_PIN    D0
#define NEO_COUNT  11

/* =====================================================
   Devices
   ===================================================== */
Adafruit_SSD1306 display(128, 64, &Wire, -1);
RtcDS3231<TwoWire> rtc(Wire);
RotaryEncoder encoder(ENC_A, ENC_B, RotaryEncoder::LatchMode::TWO03);
Adafruit_NeoPixel pixels(NEO_COUNT, NEO_PIN, NEO_GRB + NEO_KHZ800);

/* =====================================================
   Constants
   ===================================================== */
#define OLED_ADDR 0x3C

#define DEBOUNCE_MS 40
#define ENC_LONG_PRESS   1200
#define START_LONG_PRESS 1200

#define MANUAL_TIMEOUT_MS 500
#define STOP_SHOW_MS      1000

#define RUN_DRAW_MIN_MS 33

// NeoPixel fade (STANDBY/MANUAL only)
#define PIXEL_FADE_INTERVAL 20
#define FADE_RATE_BG   16
#define FADE_RATE_CUR   4
#define HSV_SAT 255
#define HSV_VAL 120
#define CUR_MIN_RATIO 30

#define BLINK_NORMAL_MS 200
#define BLINK_FAST_MS   120

#define BREATH_INTERVAL_MS 20
#define BREATH_PHASE_STEP  2
#define BREATH_MAX_V       40

#define ENC_STEP_TICKS 2

/* =====================================================
   POS / Marker distances (400mH)
   ===================================================== */
const char* posText[] = { "SG","H1","H2","H3","H4","H5","H6","H7","H8","H9","H10" };
const int POS_COUNT = 11;
const float markerDist[POS_COUNT] = {0,45,80,115,150,185,220,255,290,325,360};
const float TRACK_LEN = 400.0f;

/* =====================================================
   Modes
   ===================================================== */
enum Mode : uint8_t {
  MODE_STANDBY = 0,
  MODE_MANUAL  = 1,
  MODE_RUNNING = 2,
  MODE_SET_CLOCK = 3,
  MODE_SET_LAP   = 4
};

/* =====================================================
   Debounce
   ===================================================== */
struct Debounce {
  bool stable;
  bool last;
  unsigned long t;
};

static inline bool debounceRead(Debounce &d, bool raw) {
  unsigned long now = millis();
  if (raw != d.last) { d.last = raw; d.t = now; }
  if ((now - d.t) > DEBOUNCE_MS && d.stable != raw) {
    d.stable = raw;
    return true;
  }
  return false;
}

/* =====================================================
   Sound
   ===================================================== */
static inline void beep(int f, int d) { tone(BUZZER_PIN, f, d); }
static inline void sndClick(){ beep(2000, 10); }
static inline void sndPivot(){ beep(1500, 40); }
static inline void sndStart(){ beep(1200, 80); }
static inline void sndSG()   { beep( 900,120); }
static inline void sndStop() { beep( 400,200); }
static inline void sndEnter(){ beep(1000, 60); }
static inline void sndDone() { beep(1000, 80); delay(80); beep(1500, 140); }

// 起動音：テッテレー！
static void playStartupSound(){
  // テッ・テ・レー！
  beep(880, 120);   // テッ
  delay(150);
  beep(1047, 120);  // テ
  delay(150);
  beep(1319, 300);  // レー！
}

// 起動スプラッシュ：3秒ほど点滅
static void showSplash(){
  const unsigned long DUR_MS = 3000;
  const unsigned long BLINK_MS = 400;

  unsigned long t0 = millis();
  unsigned long last = 0;
  bool on = true;

  while (millis() - t0 < DUR_MS){
    unsigned long now = millis();
    if (now - last >= BLINK_MS){
      last = now;
      on = !on;

      display.clearDisplay();

      if (on){
        display.setTextSize(2);
        display.setCursor(0,0);
        display.print("= ePACER =");

        display.setTextSize(1);
        display.setCursor(0,32);
        display.print("Ver0.1");

        display.setCursor(0,44);
        display.print("Test Only");
      }

      display.display();
    }
    delay(1);
  }

  display.clearDisplay();
  display.display();
}

/* =====================================================
   Utils
   ===================================================== */
static inline bool isLeap(int y) { return (y%400==0)||((y%4==0)&&(y%100!=0)); }
static inline int daysInMonth(int y, int m) {
  static const int dm[] = {31,28,31,30,31,30,31,31,30,31,30,31};
  if (m==2) return dm[1] + (isLeap(y)?1:0);
  if (m<1||m>12) return 31;
  return dm[m-1];
}
static inline int clampInt(int v, int lo, int hi){ if(v<lo) return lo; if(v>hi) return hi; return v; }
static inline int wrapInt(int v, int lo, int hi){
  int span = hi-lo+1;
  while(v<lo) v+=span;
  while(v>hi) v-=span;
  return v;
}
static inline bool blink5Hz(){ return ((millis()/100)%2)==0; }

/* =====================================================
   ESP-NOW LR Broadcast: minimal packet "ePnn"
   - 4 bytes fixed: 'e','P','0'..'9','0'..'9'
   ===================================================== */
static const uint8_t BCAST_MAC[6] = {0xFF,0xFF,0xFF,0xFF,0xFF,0xFF};
static bool espnowReady = false;

static inline void logTx(const char* tag, const char pkt[4]) {
  Serial.printf("[%10lu ms] TX %-9s : %c%c%c%c\n",
                millis(), tag, pkt[0], pkt[1], pkt[2], pkt[3]);
}

static inline void send_ePnn(uint8_t id, const char* tag){
  if (id > 99) id = 99;
  char pkt[4];
  pkt[0] = 'e';
  pkt[1] = 'P';
  pkt[2] = char('0' + (id / 10));
  pkt[3] = char('0' + (id % 10));

  logTx(tag, pkt);

  if (!espnowReady) return;

  esp_err_t r = esp_now_send(BCAST_MAC, (const uint8_t*)pkt, 4);
  if (r != ESP_OK) {
    Serial.printf("[%10lu ms] TX ERROR : esp_now_send=%d\n", millis(), (int)r);
  }
}

// ★ esp32 core 3.3.x / IDF v5系：送信CBの型が wifi_tx_info_t* に変更
static void onEspNowSend(const wifi_tx_info_t* info, esp_now_send_status_t status){
  (void)info;
  (void)status;
}

// 受信CB（今回は未使用。型だけ合わせておく）
static void onEspNowRecv(const esp_now_recv_info_t* info, const uint8_t* data, int len){
  (void)info; (void)data; (void)len;
}

static void setupEspNowLRBroadcast(){
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, true);

  // WiFi起動＆CH固定
  esp_wifi_start();
  esp_wifi_set_channel(WIFI_CH, WIFI_SECOND_CHAN_NONE);

  uint8_t ch;
  wifi_second_chan_t sch;
  esp_wifi_get_channel(&ch, &sch);
  Serial.printf("[ESP] CH=%d (requested %d)\n", (int)ch, (int)WIFI_CH);

  // LRを有効化（失敗しても通常ESP-NOWで動く）
  esp_err_t pr = esp_wifi_set_protocol(
      WIFI_IF_STA,
      WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N | WIFI_PROTOCOL_LR
  );
  Serial.printf("[ESP] set_protocol(LR) = %d\n", (int)pr);

  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESP] esp_now_init FAILED");
    espnowReady = false;
    return;
  }
  espnowReady = true;
  Serial.println("[ESP] esp_now_init OK");

  esp_now_register_send_cb(onEspNowSend);
  esp_now_register_recv_cb(onEspNowRecv);

  // ブロードキャストpeer登録（必須）
  esp_now_peer_info_t peer{};
  memset(&peer, 0, sizeof(peer));
  memcpy(peer.peer_addr, BCAST_MAC, 6);
  peer.channel = WIFI_CH;   // ★ 明示的にCH固定
  peer.encrypt = false;

  esp_err_t ar = esp_now_add_peer(&peer);
  Serial.printf("[ESP] add_peer(FF:..,ch=%d)= %d\n", (int)WIFI_CH, (int)ar);
}

/* =====================================================
   App State (まとめて“かっこよく”管理)
   ===================================================== */
struct App {
  // mode
  Mode mode = MODE_STANDBY;

  // selection (MANUAL/STANDBY)
  int posIndex = 0;

  // encoder
  long lastEncPos = 0;
  long encAcc = 0;

  // debouncers
  Debounce dbStart{false,false,0};
  Debounce dbStop {false,false,0};
  Debounce dbEnc  {false,false,0};

  // STOP message
  bool stopMessage = false;
  unsigned long stopMsgMs = 0;

  // RTC sub-second base
  int lastRtcSec = -1;
  unsigned long rtcBaseMs = 0;

  // standby/manual pixel fade
  unsigned long lastFadeMs = 0;

  // set-mode blink
  bool blinkOn = true;
  unsigned long lastBlinkMs = 0;

  // set-mode breath
  unsigned long lastBreathMs = 0;
  uint8_t breathPhase = 0;

  // manual timeout
  unsigned long lastManualMs = 0;

  // running
  unsigned long lapStartMs = 0;
  unsigned long lastRunDrawMs = 0;
  int lapTimeSec = 120;
  float splitSec[POS_COUNT];

  // set clock
  enum ClockField : uint8_t { CLK_YEAR, CLK_MONTH, CLK_DAY, CLK_HOUR, CLK_MIN, CLK_SEC };
  ClockField clkField = CLK_YEAR;
  int setYear=2025, setMonth=1, setDay=1, setHour=0, setMin=0;

  // long-press guards
  bool ignoreEncRelease = false;

  // running detector
  float prev_dtNext = -9999.0f;
  int   prev_nextIdx = -1;
  long  prev_lapNo = -1;

  // hold detection
  bool startHolding = false;
  unsigned long startPressMs = 0;

  bool encHolding = false;
  unsigned long encPressMs = 0;
};

static App app;

/* =====================================================
   Split calc / time helpers
   ===================================================== */
static inline void recalcSplits(){
  for (int i=0;i<POS_COUNT;i++){
    app.splitSec[i] = app.lapTimeSec * (markerDist[i] / TRACK_LEN);
  }
}

static inline int rtcHundredth(){
  int h = (int)((millis() - app.rtcBaseMs) / 10);
  if (h < 0) h = 0;
  if (h > 99) h = 99;
  return h;
}

/* =====================================================
   NeoPixel helpers
   ===================================================== */
static inline uint32_t manualColor(){
  uint8_t hue = (app.posIndex * 32) & 0xFF;
  return pixels.ColorHSV((uint16_t)hue * 256, HSV_SAT, HSV_VAL);
}

static inline void lightCurrentFull(){
  pixels.setPixelColor(app.posIndex, manualColor());
  pixels.show();
}

static void fadePixels(){
  for (int i=0;i<NEO_COUNT;i++){
    uint32_t c = pixels.getPixelColor(i);
    uint8_t r = (c >> 16) & 0xFF;
    uint8_t g = (c >>  8) & 0xFF;
    uint8_t b =  c        & 0xFF;

    bool cur = (i == app.posIndex);
    uint8_t rate = cur ? FADE_RATE_CUR : FADE_RATE_BG;

    r = (r > rate) ? (r - rate) : 0;
    g = (g > rate) ? (g - rate) : 0;
    b = (b > rate) ? (b - rate) : 0;

    if (cur) {
      uint8_t minv = (uint8_t)(HSV_VAL * CUR_MIN_RATIO / 100);
      r = max(r, minv);
      g = max(g, minv);
      b = max(b, minv);
    }
    pixels.setPixelColor(i, r, g, b);
  }
  pixels.show();
}

static void breathPixels(uint8_t r, uint8_t g, uint8_t b){
  unsigned long now = millis();
  if (now - app.lastBreathMs < BREATH_INTERVAL_MS) return;
  app.lastBreathMs = now;

  // うっすらブレス（sin波）
  app.breathPhase = (uint8_t)(app.breathPhase + BREATH_PHASE_STEP);

  float t = sinf((app.breathPhase / 255.0f) * (float)PI); // 0..1..0
  if (t < 0) t = 0;
  uint8_t v = (uint8_t)(t * (float)BREATH_MAX_V);

  for (int i=0;i<NEO_COUNT;i++){
    pixels.setPixelColor(i, (r * v) / 255, (g * v) / 255, (b * v) / 255);
  }
  pixels.show();
}

static void confirmEffect(){
  // 白フラッシュ
  for (int k=0;k<2;k++){
    for (int i=0;i<NEO_COUNT;i++) pixels.setPixelColor(i, 40,40,60);
    pixels.show();
    delay(120);
    pixels.clear();
    pixels.show();
    delay(120);
  }

  // レインボー回転
  for (int h=0; h<256; h+=16){
    for (int i=0;i<NEO_COUNT;i++){
      pixels.setPixelColor(i, pixels.ColorHSV((uint16_t)(h + i*20) * 256, 255, 180));
    }
    pixels.show();
    delay(20);
  }

  pixels.clear();
  pixels.show();
}

/* =====================================================
   RUNNING LED logic
   ===================================================== */
static inline uint32_t lapColorByDt(float dt, bool bl){
  // dt = elapsed - markerTime
  if (dt >= -2.0f && dt < -1.0f) return bl ? pixels.Color(0,100,0) : 0;     // 赤点滅
  if (dt >= -1.0f && dt <  0.0f) return bl ? pixels.Color(100,80,0) : 0;    // 黄点滅
  if (dt >=  0.0f && dt <  1.0f) return pixels.Color(100,0,0);             // 緑
  if (dt >=  1.0f && dt <  2.0f) return pixels.Color(100,80,0);            // 黄
  if (dt >=  2.0f && dt <  3.0f) return pixels.Color(0,100,0);             // 赤
  return 0;                                                                 // 消灯
}

// elapsedMod(0..lap)から prev/next を決める
static void getPrevNextMarker(float elapsedMod, int &prevIdx, float &dtPrev, int &nextIdx, float &dtNext){
  // nextIdx: splitSec[i] >= elapsedMod の最初。無ければ SG(0)
  int n = 0;
  bool found = false;
  for (int i=0;i<POS_COUNT;i++){
    if (app.splitSec[i] >= elapsedMod){
      n = i;
      found = true;
      break;
    }
  }
  if (!found) n = 0;

  int p = (n == 0) ? (POS_COUNT - 1) : (n - 1);

  // dtPrev = elapsed - tPrev (>=0 になるのが通常。SG跨ぎでもOK)
  dtPrev = elapsedMod - app.splitSec[p];
  if (dtPrev < 0) dtPrev += (float)app.lapTimeSec;  // wrap

  // dtNext = elapsed - tNext (次は負が通常。SG跨ぎを負にする)
  dtNext = elapsedMod - app.splitSec[n];
  if (n == 0 && elapsedMod > app.splitSec[POS_COUNT-1]) {
    // 周回直前の SG 予告：負にする
    dtNext -= (float)app.lapTimeSec;
  }

  prevIdx = p;
  nextIdx = n;
}

// RUNNING中は「直前(0..3s)」優先、それ以外は「次(-2..0s)」
static void updateRunningPixel(float elapsed){
  float lap = (float)app.lapTimeSec;
  float elapsedMod = fmod(elapsed, lap);
  if (elapsedMod < 0) elapsedMod += lap;

  int prevIdx, nextIdx;
  float dtPrev, dtNext;
  getPrevNextMarker(elapsedMod, prevIdx, dtPrev, nextIdx, dtNext);

  int idx = -1;
  float dt = 999;

  // 直前マーカーの通過後 0..3 秒
  if (dtPrev >= 0.0f && dtPrev < 3.0f){
    idx = prevIdx;
    dt  = dtPrev;
  }
  // 次マーカーの到達前 -2..0 秒
  else if (dtNext >= -2.0f && dtNext < 0.0f){
    idx = nextIdx;
    dt  = dtNext;
  }

  pixels.clear();
  if (idx >= 0){
    pixels.setPixelColor(idx, lapColorByDt(dt, blink5Hz()));
  }
  pixels.show();
}

// OLEDのPOSもLEDと同じロジックで返す
static int runningPosForDisplay(float elapsed){
  float lap = (float)app.lapTimeSec;
  float elapsedMod = fmod(elapsed, lap);
  if (elapsedMod < 0) elapsedMod += lap;

  int prevIdx, nextIdx;
  float dtPrev, dtNext;
  getPrevNextMarker(elapsedMod, prevIdx, dtPrev, nextIdx, dtNext);

  if (dtPrev >= 0.0f && dtPrev < 3.0f) return prevIdx;
  if (dtNext >= -2.0f && dtNext < 0.0f) return nextIdx;

  // 何も表示しない時間帯は「次」を表示しておく（好み）
  return nextIdx;
}

/* =====================================================
   RUNNING送信タイミング②：
   「予定タイムの2秒前にLEDが赤点滅を始めた瞬間」
   = dtNext が -2.0 を跨いだ瞬間（次マーカー対象）
   ===================================================== */
static inline void resetPrewarnDetector(float elapsedNow = 0.0f){
  (void)elapsedNow;
  app.prev_dtNext = -9999.0f;
  app.prev_nextIdx = -1;
  app.prev_lapNo = -1;
}

static bool detectPrewarnEdge(float elapsed, int &idOut){
  float lap = (float)app.lapTimeSec;
  if (lap <= 0.0f) return false;

  long lapNo = (long)floor(elapsed / lap);

  float elapsedMod = fmod(elapsed, lap);
  if (elapsedMod < 0) elapsedMod += lap;

  int prevIdx, nextIdx;
  float dtPrev, dtNext;
  getPrevNextMarker(elapsedMod, prevIdx, dtPrev, nextIdx, dtNext);

  // 周回が進んだら検出器をリセット（1周につき各マーカー1回を保証しやすくする）
  if (lapNo != app.prev_lapNo) {
    app.prev_lapNo = lapNo;
    app.prev_dtNext = -9999.0f;
    app.prev_nextIdx = nextIdx;
    // リセット直後は即発火させない
    app.prev_dtNext = dtNext;
    return false;
  }

  bool fired = false;

  // 同一の nextIdx について dtNext が -2 を跨いだ瞬間のみ発火
  if (nextIdx == app.prev_nextIdx) {
    if (app.prev_dtNext < -2.0f && dtNext >= -2.0f) {
      idOut = nextIdx;   // SG=00, H1=01...
      fired = true;
    }
  } else {
    // nextIdx が切り替わったフレームは、過去値更新のみ（安全側）
  }

  app.prev_dtNext = dtNext;
  app.prev_nextIdx = nextIdx;
  return fired;
}

/* =====================================================
   OLED drawing
   ===================================================== */
static void drawNormal(const char* stateText){
  RtcDateTime n = rtc.GetDateTime();

  display.clearDisplay();
  display.setTextSize(2);

  display.setCursor(0,0);
  display.printf("%04u/%02u/%02u", n.Year(), n.Month(), n.Day());

  display.setCursor(0,16);
  display.printf("%02u:%02u:%02u", n.Hour(), n.Minute(), n.Second());

  display.setCursor(0,32);
  display.printf("POS %s", posText[app.posIndex]);

  display.setCursor(0,48);
  display.print(stateText);

  display.display();
}

static void drawRunning(float elapsed){
  int lapM = app.lapTimeSec / 60;
  int lapS = app.lapTimeSec % 60;

  int elpSec = (int)elapsed;
  int elpM = elpSec / 60;
  int elpS = elpSec % 60;
  int hund = rtcHundredth();

  display.clearDisplay();
  display.setTextSize(2);

  display.setCursor(0,0);
  display.printf("LAP %02d:%02d", lapM, lapS);

  display.setCursor(0,16);
  display.printf("%02d:%02d.%02d", elpM, elpS, hund);

  int idx = runningPosForDisplay(elapsed);
  display.setCursor(0,32);
  display.printf("POS %s", posText[idx]);

  display.setCursor(0,48);
  display.print("RUNNING");

  display.display();
}

static void drawSetLap(bool showDigits){
  RtcDateTime n = rtc.GetDateTime();
  int m = app.lapTimeSec / 60;
  int s = app.lapTimeSec % 60;

  display.clearDisplay();
  display.setTextSize(2);

  display.setCursor(0,0);
  display.printf("%04u/%02u/%02u", n.Year(), n.Month(), n.Day());

  display.setCursor(0,16);
  display.printf("%02u:%02u:%02u", n.Hour(), n.Minute(), n.Second());

  display.setCursor(0,32);
  display.print("LAP ");
  if (showDigits) display.printf("%02d:%02d", m, s);
  else display.print("     ");

  display.setCursor(0,48);
  display.print("SET LAP");

  display.display();
}

static void drawSetClock(bool showField){
  display.clearDisplay();
  display.setTextSize(2);

  display.setCursor(0,0);
  if (app.clkField==App::CLK_YEAR && !showField) display.print("    ");
  else display.printf("%04d", app.setYear);
  display.print("/");
  if (app.clkField==App::CLK_MONTH && !showField) display.print("  ");
  else display.printf("%02d", app.setMonth);
  display.print("/");
  if (app.clkField==App::CLK_DAY && !showField) display.print("  ");
  else display.printf("%02d", app.setDay);

  display.setCursor(0,16);
  if (app.clkField==App::CLK_HOUR && !showField) display.print("  ");
  else display.printf("%02d", app.setHour);
  display.print(":");
  if (app.clkField==App::CLK_MIN && !showField) display.print("  ");
  else display.printf("%02d", app.setMin);
  display.print(":");
  if (app.clkField==App::CLK_SEC && !showField) display.print("  ");
  else display.print("00");

  display.setCursor(0,48);
  display.print("SET CLOCK");

  display.display();
}

/* =====================================================
   “STOPでSGに戻す” ための統一リセット関数
   - 位置選択もSG
   - エンコーダも0へ
   - RUNNING基準もSGへ（次回STARTで00:00スタート）
   - prewarn検出器も安全側リセット
   ===================================================== */
static void resetToSG_All(){
  app.posIndex = 0;

  encoder.setPosition(0);
  app.lastEncPos = 0;
  app.encAcc = 0;

  app.lapStartMs = millis();
  app.lastRunDrawMs = 0;

  resetPrewarnDetector(0.0f);

  pixels.clear();
  pixels.show();
  lightCurrentFull();
}

/* =====================================================
   Mode transitions
   ===================================================== */
static void enterStandby(bool showStop){
  app.mode = MODE_STANDBY;
  app.stopMessage = showStop;
  if (showStop){
    app.stopMsgMs = millis();
    drawNormal("STOP");
  } else {
    drawNormal("STANDBY");
  }
}

static void enterManual(){
  app.mode = MODE_MANUAL;
  app.lastManualMs = millis();
  drawNormal("MANUAL");
}

static void enterSetLap(){
  app.mode = MODE_SET_LAP;
  app.blinkOn = true;
  app.lastBlinkMs = millis();
  sndEnter();
  drawSetLap(true);
}

static void enterSetClock(){
  RtcDateTime n = rtc.GetDateTime();
  app.setYear  = n.Year();
  app.setMonth = n.Month();
  app.setDay   = n.Day();
  app.setHour  = n.Hour();
  app.setMin   = n.Minute();
  app.clkField = App::CLK_YEAR;

  app.mode = MODE_SET_CLOCK;
  app.blinkOn = true;
  app.lastBlinkMs = millis();
  sndEnter();
  drawSetClock(true);
}

static void startRunning(){
  app.mode = MODE_RUNNING;
  app.lapStartMs = millis();
  app.lastRunDrawMs = 0;

  resetPrewarnDetector(0.0f);

  sndStart();
  sndSG();

  pixels.clear();
  pixels.show();
  updateRunningPixel(0.0f);
  drawRunning(0.0f);
}

static void stopRunning(){
  sndStop();

  // ★ STOPでSGへ戻す（周回カウンタ＆選択）
  resetToSG_All();

  enterStandby(true);
}

/* =====================================================
   RTC tick refresh (1Hzで描画をそろえる)
   ===================================================== */
static void handleRtcTick(){
  RtcDateTime now = rtc.GetDateTime();
  if (now.Second() == app.lastRtcSec) return;

  app.lastRtcSec = now.Second();
  app.rtcBaseMs = millis();

  if (app.mode == MODE_STANDBY){
    if (app.stopMessage) drawNormal("STOP");
    else drawNormal("STANDBY");
  }
  else if (app.mode == MODE_MANUAL){
    drawNormal("MANUAL");
  }
  else if (app.mode == MODE_SET_LAP){
    drawSetLap(app.blinkOn);
  }
  else if (app.mode == MODE_SET_CLOCK){
    drawSetClock(app.blinkOn);
  }
}

/* =====================================================
   Inputs + high-level behavior
   ===================================================== */
static void handleStopMessageTimeout(){
  if (!app.stopMessage) return;
  if (millis() - app.stopMsgMs >= STOP_SHOW_MS){
    app.stopMessage = false;
    if (app.mode == MODE_STANDBY) drawNormal("STANDBY");
  }
}

/* =====================================================
   Encoder rotation
   ===================================================== */
static void applyEncoderStep(int dir){
  // 設定系だけ方向反転（元仕様）
  if (app.mode == MODE_SET_CLOCK || app.mode == MODE_SET_LAP) dir = -dir;

  if (app.mode == MODE_SET_LAP){
    app.lapTimeSec = clampInt(app.lapTimeSec + dir, 1, 24*60*60);
    sndClick();
    drawSetLap(app.blinkOn);
    return;
  }

  if (app.mode == MODE_SET_CLOCK){
    sndClick();
    switch (app.clkField){
      case App::CLK_YEAR:  app.setYear  = clampInt(app.setYear + dir, 2000, 2099); break;
      case App::CLK_MONTH: app.setMonth = wrapInt(app.setMonth + dir, 1, 12); break;
      case App::CLK_DAY:   app.setDay   = wrapInt(app.setDay + dir, 1, daysInMonth(app.setYear, app.setMonth)); break;
      case App::CLK_HOUR:  app.setHour  = wrapInt(app.setHour + dir, 0, 23); break;
      case App::CLK_MIN:   app.setMin   = wrapInt(app.setMin + dir, 0, 59); break;
      case App::CLK_SEC:   break;
    }
    app.setDay = clampInt(app.setDay, 1, daysInMonth(app.setYear, app.setMonth));
    drawSetClock(app.blinkOn);
    return;
  }

  // 通常（STANDBY/MANUAL）
  app.posIndex = (app.posIndex + (dir > 0 ? 1 : (POS_COUNT - 1))) % POS_COUNT;
  sndClick();
  lightCurrentFull();
  enterManual();
}

/* =====================================================
   set-mode blinking
   ===================================================== */
static void handleSetModeBlink(){
  if (!(app.mode == MODE_SET_CLOCK || app.mode == MODE_SET_LAP)) return;

  unsigned long interval = BLINK_NORMAL_MS;
  if (app.mode == MODE_SET_CLOCK && app.clkField == App::CLK_SEC) interval = BLINK_FAST_MS;

  if (millis() - app.lastBlinkMs >= interval){
    app.lastBlinkMs = millis();
    app.blinkOn = !app.blinkOn;

    if (app.mode == MODE_SET_CLOCK) drawSetClock(app.blinkOn);
    else drawSetLap(app.blinkOn);
  }
}

/* =====================================================
   NeoPixel rendering per mode
   ===================================================== */
static void renderPixels(){
  // - RUNNING は別扱い
  if (app.mode == MODE_RUNNING) return;

  if (app.mode == MODE_SET_CLOCK){
    breathPixels(50,50,50);
    return;
  }
  if (app.mode == MODE_SET_LAP){
    breathPixels(0,0,50);
    return;
  }

  unsigned long now = millis();
  if (now - app.lastFadeMs >= PIXEL_FADE_INTERVAL){
    app.lastFadeMs = now;
    fadePixels();
  }
}

/* =====================================================
   setup / loop
   ===================================================== */
void setup(){
  Serial.begin(115200);
  delay(50);
  Serial.println("\n--- ePACER CONTROLLER (v0.1) ---");

  Wire.begin(I2C_SDA, I2C_SCL);
  display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
  display.setTextColor(SSD1306_WHITE);

  // RTC 初期化
  rtc.Begin();

  pinMode(ENC_A, INPUT_PULLUP);
  pinMode(ENC_B, INPUT_PULLUP);
  pinMode(ENC_SW, INPUT_PULLUP);
  pinMode(BTN_START, INPUT_PULLUP);
  pinMode(BTN_STOP, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);

  encoder.setPosition(0);
  app.lastEncPos = encoder.getPosition();

  pixels.begin();
  pixels.clear();
  pixels.show();

  recalcSplits();

  app.lastRtcSec = rtc.GetDateTime().Second();
  app.rtcBaseMs = millis();

  // ESP-NOW LR Broadcast init
  setupEspNowLRBroadcast();

  // 起動演出（音→表示）
  playStartupSound();
  showSplash();

  // 初期はSGを選んでおく（気持ちよさ優先）
  resetToSG_All();

  enterStandby(false);
}

void loop(){
  // ===== raw inputs (active-low) =====
  bool startRaw = !digitalRead(BTN_START);
  bool stopRaw  = !digitalRead(BTN_STOP);
  bool encRaw   = !digitalRead(ENC_SW);

  // ===== debounced edges =====
  bool startEvt = debounceRead(app.dbStart, startRaw);
  bool stopEvt  = debounceRead(app.dbStop,  stopRaw);
  bool encEvt   = debounceRead(app.dbEnc,   encRaw);

  // ===== 1Hz tick redraw =====
  handleRtcTick();

  // ===== STOP message timeout =====
  handleStopMessageTimeout();

  // ===== holding detection (START) =====
  if (startEvt && app.dbStart.stable){
    app.startHolding = true;
    app.startPressMs = millis();
  }
  if (!startRaw) app.startHolding = false;

  // ===== RUNNING mode (isolated fast-path) =====
  if (app.mode == MODE_RUNNING){
    if (stopEvt && app.dbStop.stable){
      stopRunning();
      return;
    }
    if (app.startHolding && (millis() - app.startPressMs >= START_LONG_PRESS)){
      app.startHolding = false;
      stopRunning();
      return;
    }

    float elapsed = (millis() - app.lapStartMs) / 1000.0f;

    // 長時間でも表示が崩れないよう正規化
    if (elapsed >= (float)app.lapTimeSec * 10.0f){
      unsigned long laps = (unsigned long)(elapsed / (float)app.lapTimeSec);
      app.lapStartMs += laps * (unsigned long)app.lapTimeSec * 1000UL;
      elapsed = (millis() - app.lapStartMs) / 1000.0f;
      sndSG();

      // 時間がジャンプするので検出器を安全側リセット
      resetPrewarnDetector(elapsed);
    }

    // ★送信タイミング②：T-2s（赤点滅開始の瞬間）に ePnn を送る
    int prewarnId = -1;
    if (detectPrewarnEdge(elapsed, prewarnId)){
      send_ePnn((uint8_t)prewarnId, "PREWARN");
    }

    updateRunningPixel(elapsed);

    unsigned long nowMs = millis();
    if (nowMs - app.lastRunDrawMs >= RUN_DRAW_MIN_MS){
      app.lastRunDrawMs = nowMs;
      drawRunning(elapsed);
    }
    return;
  }

  // ===== holding detection (ENC) =====
  if (encEvt && app.dbEnc.stable){
    app.encHolding = true;
    app.encPressMs = millis();
  }

  // ENC release edge
  if (encEvt && !app.dbEnc.stable){
    app.encHolding = false;

    if (app.ignoreEncRelease){
      app.ignoreEncRelease = false;
    } else {
      // short press in SET modes
      if (app.mode == MODE_SET_CLOCK){
        sndPivot();
        if (app.clkField == App::CLK_SEC){
          rtc.SetDateTime(RtcDateTime(app.setYear, app.setMonth, app.setDay, app.setHour, app.setMin, 0));
          sndDone();
          confirmEffect();       // ★派手な演出
          enterStandby(false);
        } else {
          app.clkField = (App::ClockField)((int)app.clkField + 1);
          drawSetClock(true);
        }
      }
      else if (app.mode == MODE_SET_LAP){
        recalcSplits();
        sndDone();
        confirmEffect();         // ★派手な演出
        enterStandby(false);
      }
    }
  }

  // ENC long press → SET CLOCK
  if ((app.mode == MODE_STANDBY || app.mode == MODE_MANUAL) && app.encHolding){
    if (millis() - app.encPressMs >= ENC_LONG_PRESS){
      app.encHolding = false;
      app.ignoreEncRelease = true;
      enterSetClock();
      return;
    }
  }

  // ===== STOP pressed in STANDBY/MANUAL: “SGに戻す” =====
  // ただし SET LAP 入口（STOP保持 + START押下）を優先したいので、
  // STOP単独の短押しとして扱う：stopEvt & stable のタイミングで実行。
  if ((app.mode == MODE_STANDBY || app.mode == MODE_MANUAL) && stopEvt && app.dbStop.stable){
    // ここでSG復帰（周回カウンタもSGへ）
    resetToSG_All();
    enterManual();          // すぐ目に見えるフィードバックを出す
    return;
  }

  // SET LAP入口：STOP保持 + START押下（エッジ）
  if ((app.mode == MODE_STANDBY || app.mode == MODE_MANUAL) && stopRaw && startEvt && app.dbStart.stable){
    enterSetLap();
    return;
  }

  // START単独：RUNNING開始
  if ((app.mode == MODE_STANDBY || app.mode == MODE_MANUAL) && startEvt && app.dbStart.stable){
    startRunning();
    return;
  }

  // ===== Encoder rotation =====
  encoder.tick();
  long p = encoder.getPosition();
  long diff = p - app.lastEncPos;
  app.lastEncPos = p;

  if (diff != 0){
    app.encAcc += diff;

    while (app.encAcc >= ENC_STEP_TICKS){
      app.encAcc -= ENC_STEP_TICKS;
      applyEncoderStep(+1);
    }
    while (app.encAcc <= -ENC_STEP_TICKS){
      app.encAcc += ENC_STEP_TICKS;
      applyEncoderStep(-1);
    }
  }

  // ★送信タイミング①：MANUAL → STANDBY に戻る“瞬間”に ePnn を送る
  if (app.mode == MODE_MANUAL && (millis() - app.lastManualMs >= MANUAL_TIMEOUT_MS)){
    send_ePnn((uint8_t)app.posIndex, "ID_COMMIT"); // SG=00, H1=01...
    enterStandby(false);
  }

  // set-mode blinking
  handleSetModeBlink();

  // pixels per mode
  renderPixels();
}
