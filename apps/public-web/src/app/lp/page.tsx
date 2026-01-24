import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ELEPHANT 陸上クラブ | 走る楽しさを、すべての人に",
  description: "初心者からベテランまで歓迎！週末練習で仕事と両立しやすい陸上クラブです。体験練習随時受付中。",
  openGraph: {
    title: "ELEPHANT 陸上クラブ",
    description: "走る楽しさを、すべての人に。初心者からベテランまで歓迎する陸上クラブです。",
    type: "website",
    locale: "ja_JP",
    siteName: "ELEPHANT 陸上クラブ",
  },
  twitter: {
    card: "summary_large_image",
    title: "ELEPHANT 陸上クラブ",
    description: "走る楽しさを、すべての人に。初心者からベテランまで歓迎する陸上クラブです。",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section - Large and impactful */}
      <section className="relative bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center">
            <div className="inline-block bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm mb-6">
              東京を拠点に活動中
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              走る楽しさを、
              <br />
              <span className="text-yellow-300">すべての人に。</span>
            </h1>
            <p className="text-xl md:text-2xl mb-4 text-orange-100 max-w-2xl mx-auto">
              ELEPHANT 陸上クラブ
            </p>
            <p className="text-lg text-orange-200 mb-10 max-w-xl mx-auto">
              初心者からベテランまで、年齢・経験問わず
              <br className="hidden sm:inline" />
              走ることを楽しみたいすべての方を歓迎します
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="bg-white text-orange-600 px-8 py-4 rounded-full font-bold text-lg hover:bg-yellow-300 hover:text-orange-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                体験練習に参加する
              </Link>
              <Link
                href="/about"
                className="border-2 border-white text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white hover:text-orange-600 transition-all"
              >
                詳しく見る
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* Quick Info Cards */}
      <section className="py-16 bg-white -mt-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center transform hover:-translate-y-2 transition-all">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🏃</span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-800">初心者OK</h3>
              <p className="text-gray-600">
                走り始めたばかりでも大丈夫。
                <br />
                あなたのペースで。
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center transform hover:-translate-y-2 transition-all">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📅</span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-800">週末練習</h3>
              <p className="text-gray-600">
                土日の朝に活動。
                <br />
                仕事や学校と両立可能。
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center transform hover:-translate-y-2 transition-all">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎯</span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-800">大会参加</h3>
              <p className="text-gray-600">
                マラソン大会にも挑戦。
                <br />
                目標を持って走ろう。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What We Offer */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-800">
            ELEPHANTで得られること
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            ひとりで走るのとは違う、仲間と走る楽しさがあります
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4 bg-white p-6 rounded-xl shadow-sm">
              <div className="flex-shrink-0 w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                1
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  正しいフォームを学べる
                </h3>
                <p className="text-gray-600">
                  経験者からのアドバイスで、効率的で怪我をしにくい走り方を身につけられます。
                </p>
              </div>
            </div>

            <div className="flex gap-4 bg-white p-6 rounded-xl shadow-sm">
              <div className="flex-shrink-0 w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                2
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  モチベーションが続く
                </h3>
                <p className="text-gray-600">
                  一緒に走る仲間がいるから、三日坊主にならずに続けられます。
                </p>
              </div>
            </div>

            <div className="flex gap-4 bg-white p-6 rounded-xl shadow-sm">
              <div className="flex-shrink-0 w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                3
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  ランニング仲間ができる
                </h3>
                <p className="text-gray-600">
                  同じ趣味を持つ仲間との出会いが、人生をより豊かにしてくれます。
                </p>
              </div>
            </div>

            <div className="flex gap-4 bg-white p-6 rounded-xl shadow-sm">
              <div className="flex-shrink-0 w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                4
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  大会に挑戦できる
                </h3>
                <p className="text-gray-600">
                  ひとりでは不安な大会参加も、仲間と一緒なら心強い。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule Summary */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-800">
            練習スケジュール
          </h2>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-8">
              <div className="text-orange-600 font-bold text-lg mb-2">土曜日</div>
              <div className="text-2xl font-bold text-gray-800 mb-4">8:00 - 10:00</div>
              <div className="space-y-2 text-gray-600">
                <p>📍 代々木公園 陸上競技場</p>
                <p>🏃 基本練習（ジョグ、流し、ペース走）</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-8">
              <div className="text-orange-600 font-bold text-lg mb-2">日曜日</div>
              <div className="text-2xl font-bold text-gray-800 mb-4">7:00 - 9:00</div>
              <div className="space-y-2 text-gray-600">
                <p>📍 駒沢オリンピック公園</p>
                <p>🏃 ロング走・距離走（10km〜20km）</p>
              </div>
            </div>
          </div>

          <p className="text-center text-gray-500 mt-8">
            ※ 天候により変更になる場合があります
          </p>
        </div>
      </section>

      {/* Membership */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            入会について
          </h2>

          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-800 rounded-2xl p-8 space-y-6">
              <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                <span className="text-gray-400">年会費</span>
                <span className="text-2xl font-bold">
                  ¥12,000<span className="text-sm font-normal text-gray-400">/年</span>
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                <span className="text-gray-400">学生</span>
                <span className="text-2xl font-bold">
                  ¥6,000<span className="text-sm font-normal text-gray-400">/年</span>
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                <span className="text-gray-400">入会金</span>
                <span className="text-2xl font-bold">¥3,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">体験練習</span>
                <span className="text-2xl font-bold text-orange-400">無料</span>
              </div>
            </div>

            <p className="text-center text-gray-400 mt-6">
              まずは体験練習から。お気軽にご参加ください。
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            一緒に走りませんか？
          </h2>
          <p className="text-xl text-orange-100 mb-10 max-w-2xl mx-auto">
            体験練習は随時受付中。
            <br />
            まずはお気軽にお問い合わせください。
          </p>
          <Link
            href="/contact"
            className="inline-block bg-white text-orange-600 px-10 py-5 rounded-full font-bold text-xl hover:bg-yellow-300 hover:text-orange-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            体験練習に申し込む
          </Link>
        </div>
      </section>
    </div>
  );
}
