import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ELEPHANT 陸上クラブ | 北海道限定の大会申込代行クラブ",
  description: "ELEPHANT陸上クラブは、陸上大会のエントリー申込代行を行う北海道限定の陸上クラブです。大会エントリーの手間を省き、簡単に大会参加ができます。",
};

export default function HomePage() {
  return (
    <div className="py-16">
      {/* Page Header */}
      <div className="bg-orange-500 text-white py-12 mb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-bold">ELEPHANT 陸上クラブ</h1>
          <p className="mt-2 text-orange-100">Track & Field Club</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Introduction */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">ELEPHANTとは</h2>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
            <p className="text-blue-800 font-semibold">📍 北海道限定の陸上クラブです</p>
          </div>
          <div className="prose max-w-none text-gray-600">
            <p className="text-lg leading-relaxed mb-4">
              陸上競技者のための大会申込代行を行う陸上クラブです。
              煩雑なエントリー手続きや支払いを代行し、競技に専念できる環境を提供します。
            </p>
            <p className="text-lg leading-relaxed">
              練習会や交流会は開催せず、大会エントリーの利便性向上に特化したクラブ運営を行っています。
              日本陸連への登録も含め、事務手続きは全てお任せください。
            </p>
          </div>
        </section>

        {/* How to Use - Step by Step */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">ご利用の流れ</h2>
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="bg-orange-500 text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-lg mb-2">大会を伝える</h3>
              <p className="text-gray-600 text-sm">出たい大会と種目を連絡するだけ</p>
            </div>
            <div className="text-center relative">
              <div className="hidden md:block absolute top-8 left-0 w-full h-0.5 bg-orange-200 -z-10"></div>
              <div className="bg-orange-500 text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-lg mb-2">申込完了</h3>
              <p className="text-gray-600 text-sm">エントリー手続きは全て代行</p>
            </div>
            <div className="text-center relative">
              <div className="hidden md:block absolute top-8 left-0 w-full h-0.5 bg-orange-200 -z-10"></div>
              <div className="bg-orange-500 text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-lg mb-2">大会に出場</h3>
              <p className="text-gray-600 text-sm">競技に集中できます</p>
            </div>
          </div>
        </section>

        {/* Service Features */}
        <section className="mb-16 bg-orange-50 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">クラブの特徴</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-3">📝</div>
              <h3 className="text-xl font-semibold mb-3 text-orange-600">ワンストップ申込</h3>
              <p className="text-gray-600">
                大会と種目を伝えるだけ。フォーム入力や書類準備は不要です。
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-3">💰</div>
              <h3 className="text-xl font-semibold mb-3 text-orange-600">シーズン一括決済</h3>
              <p className="text-gray-600">
                シーズン単位で清算。大会ごとの振込手続きは不要です。
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-3">🏃</div>
              <h3 className="text-xl font-semibold mb-3 text-orange-600">陸連登録サポート</h3>
              <p className="text-gray-600">
                陸連への登録手続きも代行。事務作業に時間を取られません。
              </p>
            </div>
          </div>
        </section>

        {/* Payment System - Visual Flow */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">お支払いの仕組み</h2>
          
          {/* Simple Flow */}
          <div className="bg-orange-50 rounded-lg p-6 mb-6">
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 max-w-5xl mx-auto">
              {/* 期初 */}
              <div className="bg-white rounded-lg p-6 shadow-md flex-1 w-full md:w-auto">
                <div className="text-xl font-bold text-orange-600 mb-3">期初</div>
                <div className="text-gray-600 mb-2">前金をお預かり</div>
                <div className="text-4xl font-bold text-gray-800">¥10,000</div>
              </div>
              
              <div className="text-3xl text-orange-500 transform md:rotate-0 rotate-90">→</div>
              
              {/* シーズン中 */}
              <div className="bg-white rounded-lg p-6 shadow-md flex-1 w-full md:w-auto">
                <div className="text-xl font-bold text-orange-600 mb-3">シーズン中</div>
                <div className="text-gray-600 mb-2">大会に参加</div>
                <div className="text-lg font-semibold text-gray-800">毎回の振込不要！</div>
              </div>
              
              <div className="text-3xl text-orange-500 transform md:rotate-0 rotate-90">→</div>
              
              {/* 期末 */}
              <div className="bg-white rounded-lg p-6 shadow-md flex-1 w-full md:w-auto">
                <div className="text-xl font-bold text-orange-600 mb-3">期末</div>
                <div className="text-gray-600 mb-2">差額を精算</div>
                <div className="font-semibold text-gray-800">追加払い or 返金</div>
              </div>
            </div>
          </div>

          {/* Examples */}
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-800 mb-2">📊 例1：追加払いのケース</h3>
              <div className="text-gray-700">
                前金 1万円 → シーズン中に 1.3万円使用 → <span className="font-bold text-green-700">期末に差額 3千円を支払い</span>
              </div>
            </div>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-800 mb-2">📊 例2：返金のケース</h3>
              <div className="text-gray-700">
                前金 1万円 → シーズン中に 8千円使用 → <span className="font-bold text-blue-700">期末に差額 2千円を返金</span>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg max-w-2xl mx-auto">
            <h3 className="font-semibold text-gray-800 mb-2">💳 決済手段</h3>
            <p className="text-gray-600">銀行振込・PayPayに対応</p>
          </div>
        </section>

        {/* Pricing - Card Style */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">料金体系</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-6 shadow-lg">
              <div className="text-sm font-semibold mb-2 opacity-90">年会費</div>
              <div className="text-5xl font-bold mb-2">¥2,000</div>
              <div className="text-sm opacity-90">/年</div>
            </div>
            <div className="bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-xl p-6 shadow-lg">
              <div className="text-sm font-semibold mb-2 opacity-90">エントリー代行手数料</div>
              <div className="text-5xl font-bold mb-2">¥300</div>
              <div className="text-sm opacity-90">/大会</div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded max-w-3xl mx-auto">
            <p className="text-sm text-gray-700">
              <strong>💡 ポイント：</strong>同一大会内であれば、複数種目も一律300円<br />
              <span className="text-gray-600">（例：100m単独 → 300円 / 100m・200m → 300円）</span>
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            ※ お問い合わせ: athletics.elephant.club@gmail.com
          </p>
        </section>
      </div>
    </div>
  );
}
