import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ELEPHANT 陸上クラブ | 北海道限定の陸連登録・大会申込代行クラブ",
  description: "ELEPHANT陸上クラブは、陸連登録と陸上大会のエントリー申込代行を行う北海道限定の陸上クラブです。複数のプランから選べて、大会エントリーの手間を省き、簡単に大会参加ができます。",
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
          <h2 className="text-2xl font-bold mb-6 text-gray-800">エレファントとは</h2>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
            <p className="text-blue-800 font-semibold">📍 北海道限定の陸上クラブです</p>
          </div>
          <div className="prose max-w-none text-gray-600">
            <p className="text-lg leading-relaxed mb-4">
              陸上競技者のための<strong>陸連登録代行</strong>と<strong>大会申込代行</strong>を行う陸上クラブです。
              煩雑な登録手続きやエントリー手続きを代行し、競技に専える環境を提供します。
            </p>
            <p className="text-lg leading-relaxed">
              練習会や交流会は開催せず、事務手続きの利便性向上に特化したクラブ運営を行っています。
              日本陸連への登録から大会エントリーまで、全ての事務手続きをお任せください。
              なお、クラブユニフォームはありません。
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
                陸連登録から大会エントリーまで全て代行。フォーム入力や書類準備は不要です。
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-3">💰</div>
              <h3 className="text-xl font-semibold mb-3 text-orange-600">選べるプラン</h3>
              <p className="text-gray-600">
                入門からプレミアムまで、参加スタイルに合わせた料金プランをご用意。
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-3">🏃</div>
              <h3 className="text-xl font-semibold mb-3 text-orange-600">陸連登録サポート</h3>
              <p className="text-gray-600">
                陸連への登録手続きも代行。煩雑な事務作業から解放されます。
              </p>
            </div>
          </div>
        </section>

        {/* Pricing Plans */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 text-center">料金プラン</h2>
          
          {/* Fee Inclusion Highlight */}
          <div className="max-w-4xl mx-auto mb-8 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl p-6 shadow-md text-center border-4 border-orange-300">
            <h3 className="text-xl md:text-2xl font-bold mb-3">📢 すべて「大会参加料」＆「陸連登録料」込み！</h3>
            <div className="text-lg md:text-xl space-y-2">
              <p>
                各プランの料金には、<strong>大会参加料</strong>や<strong>陸連登録費用</strong>が最初からすべて含まれています。
              </p>
              <p className="bg-white/20 py-2 px-4 rounded-lg font-bold">
                大会のたびに参加料を払ったり、陸連登録費用を別途払う必要はありません！
              </p>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-8">
            {/* 入門プラン */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-6 shadow-lg relative">
              <div className="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                初年度限定
              </div>
              <h3 className="text-2xl font-bold text-green-700 mb-2">入門プラン</h3>
              <div className="text-4xl font-bold text-gray-800 mb-1">¥9,000</div>
              <p className="text-sm text-green-600 font-bold mb-4">登録料・参加料込み</p>
              <div className="space-y-2 text-gray-700">
                <p className="flex items-center font-bold text-green-700">
                  <span className="mr-2">✓</span> 1大会エントリーまで
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span> 陸連登録代行
                </p>
              </div>
            </div>

            {/* 単発レースプラン */}
            <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-700 mb-2">単発レースプラン</h3>
              <div className="text-4xl font-bold text-gray-800 mb-1">¥15,000</div>
              <p className="text-sm text-gray-600 font-bold mb-4">登録料・参加料込み</p>
              <div className="space-y-2 text-gray-700">
                <p className="flex items-center font-bold text-gray-700">
                  <span className="mr-2">✓</span> 1大会エントリーまで
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span> 陸連登録代行
                </p>
              </div>
            </div>

            {/* ライトプラン */}
            <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-lg">
              <h3 className="text-2xl font-bold text-blue-700 mb-2">ライトプラン</h3>
              <div className="text-4xl font-bold text-gray-800 mb-1">¥20,000</div>
              <p className="text-sm text-blue-600 font-bold mb-4">登録料・参加料込み</p>
              <div className="space-y-2 text-gray-700">
                <p className="flex items-center font-bold text-blue-600 text-lg">
                  <span className="mr-2">✓</span> 3大会エントリーまで
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span> 陸連登録代行
                </p>
              </div>
            </div>

            {/* スタンダードプラン */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-300 rounded-xl p-6 shadow-lg">
              <h3 className="text-2xl font-bold text-orange-700 mb-2">スタンダードプラン</h3>
              <div className="text-4xl font-bold text-gray-800 mb-1">¥40,000</div>
              <p className="text-sm text-orange-600 font-bold mb-4">登録料・参加料込み</p>
              <div className="space-y-2 text-gray-700">
                <p className="flex items-center font-bold text-orange-600 text-lg">
                  <span className="mr-2">✓</span> 8大会エントリーまで
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span> 陸連登録代行
                </p>
              </div>
            </div>

            {/* プレミアムプラン */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-xl p-6 shadow-lg md:col-span-2 lg:col-span-1">
              <h3 className="text-2xl font-bold text-purple-700 mb-2">プレミアムプラン</h3>
              <div className="text-4xl font-bold text-gray-800 mb-1">¥200,000</div>
              <p className="text-sm text-purple-600 font-bold mb-4">登録料・参加料込み</p>
              <div className="space-y-2 text-gray-700">
                <p className="flex items-center font-bold text-purple-600 text-lg">
                  <span className="mr-2">✓</span> 50大会エントリーまで
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span> 陸連登録代行
                </p>
              </div>
            </div>
          </div>

          {/* 追加オプション */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-6 shadow-md">
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">追加オプション</h3>
              
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <div className="flex-1">
                  <p className="text-xl font-bold text-gray-800">1大会追加</p>
                  <p className="text-orange-600 font-bold text-2xl">¥5,000</p>
                </div>
                <div className="flex-1 text-sm text-gray-600">
                  各プランの上限回数を超えて大会に出場したくなった場合のオプションです。<strong>（大会参加料込み）</strong>
                </div>
              </div>

              <div className="bg-white p-4 rounded border border-gray-200">
                <p className="text-sm font-bold text-gray-700 mb-2">💡 例えばこんな時に：</p>
                <p className="text-sm text-gray-600">
                  「入門プラン（1大会まで）で登録したけど、調子が良いので<strong>2大会目も出場したい！</strong>」
                  <br />
                  そんな時は＋5,000円で2大会目のエントリー代行も承ります。もちろん追加の参加料支払いは不要です。
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto bg-orange-50 border-l-4 border-orange-500 rounded p-6 mb-6">
            <h3 className="font-bold text-gray-800 mb-3 text-lg">📧 お申し込み方法</h3>
            <p className="text-gray-700">
              お申し込みは <strong className="text-orange-700">athletics.elephant.club@gmail.com</strong> まで
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg max-w-4xl mx-auto">
            <h3 className="font-semibold text-gray-800 mb-2">💳 決済手段</h3>
            <p className="text-gray-600">銀行振込・PayPayに対応</p>
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            ※ お問い合わせ: athletics.elephant.club@gmail.com
          </p>
        </section>
      </div>
    </div>
  );
}
