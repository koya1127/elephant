#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <Adafruit_NeoPixel.h>

/* =====================================================
   Config
   ===================================================== */
#define WIFI_CH       1
#define SERIAL_BAUD   115200

/* =====================================================
   Pin Assign (XIAO ESP32-C3 / D表記)
   ===================================================== */
#define PIN_NEOPIXEL D0
#define PIN_BUTTON   D8

#define PIN_DIP0     D1
#define PIN_DIP1     D2
#define PIN_DIP2     D3
#define PIN_DIP3     D10

/* =====================================================
   NeoPixel
   ===================================================== */
#define NUM_PIXELS_LOGICAL 64   // 将来拡張用（未使用）
#define NUM_PIXELS_PHYS    8
#define BRIGHTNESS         255

Adafruit_NeoPixel pixels(
  NUM_PIXELS_PHYS,
  PIN_NEOPIXEL,
  NEO_GRB + NEO_KHZ800
);

/* =====================================================
   Timing
   ===================================================== */
#define ID_BLINK_COUNT   3
#define ID_BLINK_PERIOD  1000

#define RX_INDICATE_MS   200

#define BLINK_5HZ_ON     100
#define BLINK_5HZ_OFF    100

/* =====================================================
   State
   ===================================================== */
enum State {
  ST_ID_DISPLAY,
  ST_IDLE,
  ST_EVENT
};

volatile State state = ST_ID_DISPLAY;
uint8_t myID = 0;

/* =====================================================
   Utility
   ===================================================== */
uint8_t readID() {
  uint8_t id = 0;
  id |= (!digitalRead(PIN_DIP0)) << 0;
  id |= (!digitalRead(PIN_DIP1)) << 1;
  id |= (!digitalRead(PIN_DIP2)) << 2;
  id |= (!digitalRead(PIN_DIP3)) << 3;
  return id;
}

void allOff() {
  pixels.clear();
  pixels.show();
}

/* =====================================================
   GRB 明示ユーティリティ
   ===================================================== */
void fillAll(uint8_t g, uint8_t r, uint8_t b) {
  for (int i = 0; i < NUM_PIXELS_PHYS; i++) {
    pixels.setPixelColor(i, r, g, b); // APIはRGB、意味はGRB
  }
  pixels.show();
}

void blinkAll(uint8_t g, uint8_t r, uint8_t b,
              uint32_t onMs, uint32_t offMs,
              uint32_t durationMs) {
  uint32_t start = millis();
  while (millis() - start < durationMs) {
    fillAll(g, r, b);
    delay(onMs);
    allOff();
    delay(offMs);
  }
}

/* =====================================================
   ID Display
   ===================================================== */
void showID() {
  state = ST_ID_DISPLAY;

  Serial.printf("[ID] display ID=%02d\n", myID);

  for (int i = 0; i < ID_BLINK_COUNT; i++) {
    for (int bit = 0; bit < 4; bit++) {
      if (myID & (1 << bit)) {
        if (bit < NUM_PIXELS_PHYS) {
          pixels.setPixelColor(bit, 255, 0, 0); // 赤（RGB指定）
        }
      }
    }
    pixels.show();
    delay(ID_BLINK_PERIOD / 2);
    allOff();
    delay(ID_BLINK_PERIOD / 2);
  }

  state = ST_IDLE;
}

/* =====================================================
   Serial Log
   ===================================================== */
void logPacket(const uint8_t* data, int len) {
  Serial.printf("[%8lu ms] RX len=%d : ", millis(), len);
  for (int i = 0; i < len; i++) {
    Serial.printf("%02X ", data[i]);
  }
  Serial.println();
}

/* =====================================================
   ESP-NOW RX Callback
   ===================================================== */
void onEspNowRecv(const esp_now_recv_info_t*,
                  const uint8_t* data,
                  int len) {

  logPacket(data, len);

  if (state != ST_IDLE) return;
  if (len < 2) return;
  if (data[0] != 'e' ) return;

  // RX インジケータ（最終LEDを青）
  if (NUM_PIXELS_PHYS > 7) {
    pixels.setPixelColor(7, 0, 0, 255); // 青
    pixels.show();
    delay(RX_INDICATE_MS);
    allOff();
  }

  if (len < 6) return;  // 最低6バイト必要
  
  uint8_t id1 = (data[1] >> 4) & 0x0F;  // 上位4bit
  uint8_t id2 = data[1] & 0x0F;         // 下位4bit
  if (id1 != myID && id2 != myID) return;

  // offset時間を取得
  uint16_t offset;
  if (id1 == myID) {
    offset = (data[2] << 8) | data[3];  // ID#1用offset
  } else {
    offset = (data[4] << 8) | data[5];  // ID#2用offset
  }

  state = ST_EVENT;
  delay(offset);  // offset時間待機

  // 点滅（全LED）
  blinkAll(0,   255, 0, BLINK_5HZ_ON, BLINK_5HZ_OFF, 1000); // 赤点滅
  blinkAll(255, 255, 0, BLINK_5HZ_ON, BLINK_5HZ_OFF, 1000); // 黄点滅

  // ベタ（全LED）
  fillAll(255, 0,   0);  delay(1000); // 緑
  fillAll(255, 255, 0);  delay(1000); // 黄
  fillAll(0,   255, 0);  delay(1000); // 赤

  allOff();
  state = ST_IDLE;
}

/* =====================================================
   setup
   ===================================================== */
void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(300);

  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_DIP0, INPUT_PULLUP);
  pinMode(PIN_DIP1, INPUT_PULLUP);
  pinMode(PIN_DIP2, INPUT_PULLUP);
  pinMode(PIN_DIP3, INPUT_PULLUP);

  pixels.begin();
  pixels.setBrightness(BRIGHTNESS);
  allOff();

  myID = readID();

  Serial.println("=== ePACER MARKER ===");
  Serial.printf("BOOT ID = %02d\n", myID);

  showID();

  WiFi.mode(WIFI_STA);
  delay(100);
  WiFi.disconnect(false);
  delay(100);

  esp_wifi_start();
  delay(100);

  esp_wifi_set_protocol(
    WIFI_IF_STA,
    WIFI_PROTOCOL_11B |
    WIFI_PROTOCOL_11G |
    WIFI_PROTOCOL_11N |
    WIFI_PROTOCOL_LR
  );
  delay(100);

  esp_wifi_set_channel(WIFI_CH, WIFI_SECOND_CHAN_NONE);
  delay(100);

  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESP-NOW] init FAILED");
    return;
  }

  esp_now_peer_info_t peer{};
  memset(peer.peer_addr, 0xFF, 6);
  peer.channel = WIFI_CH;
  peer.encrypt = false;
  esp_now_add_peer(&peer);

  esp_now_register_recv_cb(onEspNowRecv);

  Serial.println("[ESP-NOW] ready");
}

/* =====================================================
   loop
   ===================================================== */
void loop() {
  static bool lastBtn = true;
  bool btn = digitalRead(PIN_BUTTON);

  // ボタン押下 → ID 再読込
  if (state == ST_IDLE && lastBtn && !btn) {
    delay(30);
    if (digitalRead(PIN_BUTTON) == LOW) {
      myID = readID();
      Serial.printf("[BTN] reload ID = %02d\n", myID);
      showID();
      while (digitalRead(PIN_BUTTON) == LOW) delay(10);
    }
  }

  lastBtn = btn;
}
