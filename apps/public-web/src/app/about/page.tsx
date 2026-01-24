import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "クラブについて | ELEPHANT 陸上クラブ",
  description: "ELEPHANT陸上クラブの紹介ページです。クラブの理念、活動内容、入会案内などをご覧いただけます。",
};

export default function AboutPage() {
  return (
    <div className="py-16">
      {/* Page Header */}
      <div className="bg-orange-500 text-white py-12 mb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-bold">クラブについて</h1>
          <p className="mt-2 text-orange-100">About Us</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Introduction */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">ELEPHANTとは</h2>
          <div className="prose max-w-none text-gray-600">
            <p className="text-lg leading-relaxed mb-4">
              ELEPHANT陸上クラブは、「走る楽しさを、すべての人に」をモットーに活動する陸上クラブです。
              初心者からベテランまで、年齢や経験を問わず、走ることを楽しみたいすべての方を歓迎しています。
            </p>
            <p className="text-lg leading-relaxed">
              象のように力強く、着実に、そして仲間と一緒に歩みを進めていく。
              そんな想いを込めて「ELEPHANT」と名付けました。
            </p>
          </div>
        </section>

        {/* Philosophy */}
        <section className="mb-16 bg-orange-50 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">クラブ理念</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-3 text-orange-600">楽しむ</h3>
              <p className="text-gray-600">
                走ることの楽しさを第一に。無理なく、自分のペースで走ることを大切にしています。
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-3 text-orange-600">成長する</h3>
              <p className="text-gray-600">
                小さな目標を一つずつクリアし、着実に成長していく喜びを分かち合います。
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-3 text-orange-600">つながる</h3>
              <p className="text-gray-600">
                走ることを通じて生まれる仲間との絆を大切にしています。
              </p>
            </div>
          </div>
        </section>

        {/* Activities */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">主な活動</h2>
          <div className="space-y-6">
            <div className="border-l-4 border-orange-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-800">週末練習会</h3>
              <p className="text-gray-600">
                毎週土曜日・日曜日に定期練習を実施。ジョギングからインターバルトレーニングまで、
                レベルに合わせたメニューを用意しています。
              </p>
            </div>
            <div className="border-l-4 border-orange-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-800">大会参加</h3>
              <p className="text-gray-600">
                地域のマラソン大会や記録会に積極的に参加。目標を持って走ることで、
                モチベーションを高めています。
              </p>
            </div>
            <div className="border-l-4 border-orange-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-800">イベント</h3>
              <p className="text-gray-600">
                合宿、懇親会、ランニングクリニックなど、走ること以外のイベントも開催しています。
              </p>
            </div>
          </div>
        </section>

        {/* Membership */}
        <section className="bg-gray-100 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">入会案内</h2>
          <div className="space-y-4 text-gray-600">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <span className="font-semibold text-gray-800 md:w-32">対象</span>
              <span>18歳以上で走ることに興味のある方（経験不問）</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <span className="font-semibold text-gray-800 md:w-32">年会費</span>
              <span>12,000円（学生：6,000円）</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <span className="font-semibold text-gray-800 md:w-32">入会金</span>
              <span>3,000円（初年度のみ）</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <span className="font-semibold text-gray-800 md:w-32">体験練習</span>
              <span>随時受付中（無料・要事前連絡）</span>
            </div>
          </div>
          <p className="mt-6 text-sm text-gray-500">
            ※ 詳しくはお問い合わせページよりご連絡ください。
          </p>
        </section>
      </div>
    </div>
  );
}
