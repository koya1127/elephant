import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "練習スケジュール | ELEPHANT 陸上クラブ",
  description: "ELEPHANT陸上クラブの練習スケジュールです。毎週の練習日程や場所をご確認いただけます。",
};

const scheduleData = [
  {
    day: "土曜日",
    time: "8:00 - 10:00",
    location: "代々木公園 陸上競技場",
    content: "基本練習（ジョグ、流し、ペース走など）",
  },
  {
    day: "日曜日",
    time: "7:00 - 9:00",
    location: "駒沢オリンピック公園",
    content: "ロング走・距離走（10km〜20km）",
  },
];

const monthlyEvents = [
  { month: "1月", event: "新年ラン、ニューイヤー駅伝観戦" },
  { month: "2月", event: "東京マラソン応援" },
  { month: "3月", event: "春合宿" },
  { month: "4月", event: "花見ラン" },
  { month: "5月", event: "GW練習会" },
  { month: "6月", event: "梅雨明けトラック練習" },
  { month: "7月", event: "夏合宿" },
  { month: "8月", event: "早朝練習強化月間" },
  { month: "9月", event: "秋シーズン開始" },
  { month: "10月", event: "各地マラソン大会参加" },
  { month: "11月", event: "記録会参加" },
  { month: "12月", event: "忘年ラン、納会" },
];

export default function SchedulePage() {
  return (
    <div className="py-16">
      {/* Page Header */}
      <div className="bg-orange-500 text-white py-12 mb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-bold">練習スケジュール</h1>
          <p className="mt-2 text-orange-100">Schedule</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Weekly Schedule */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">週間スケジュール</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {scheduleData.map((schedule) => (
              <div
                key={schedule.day}
                className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    {schedule.day}
                  </span>
                  <span className="text-lg font-semibold text-gray-800">
                    {schedule.time}
                  </span>
                </div>
                <div className="space-y-2 text-gray-600">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>{schedule.location}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <span>{schedule.content}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-gray-500">
            ※ 天候や施設の都合により、場所・時間が変更になる場合があります。
            最新情報はSNSでご確認ください。
          </p>
        </section>

        {/* Monthly Events */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">年間イベント</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {monthlyEvents.map((item) => (
              <div
                key={item.month}
                className="bg-orange-50 rounded-lg p-4"
              >
                <span className="text-orange-600 font-bold">{item.month}</span>
                <p className="text-gray-600 text-sm mt-1">{item.event}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Notes */}
        <section className="bg-gray-100 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">練習参加について</h2>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-orange-500 font-bold">・</span>
              体験参加は随時受け付けています。事前にお問い合わせください。
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 font-bold">・</span>
              運動できる服装、シューズ、飲み物をご持参ください。
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 font-bold">・</span>
              雨天時は原則中止となります。判断に迷う場合はSNSでお知らせします。
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 font-bold">・</span>
              各自でスポーツ保険への加入をお願いしています。
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
