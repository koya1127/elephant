import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "エレファント陸上クラブ | 北海道限定の陸連登録・大会申込代行クラブ",
  description: "エレファント陸上クラブは、陸連登録と陸上大会のエントリー申込代行を行う北海道限定の年間サービス型陸上クラブです。複数のプランから選べて、大会エントリーの手間を省き、簡単に大会参加ができます。",
};

export default function HomePage() {
  return (
    <div className="py-16">
      {/* Page Header */}
      <div className="bg-orange-500 text-white py-12 mb-12 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-5xl font-bold">エレファント陸上クラブ</h1>
          <p className="mt-2 text-orange-100 text-lg">Track & Field Club</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* The High Wall of Track & Field Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-8 text-center text-gray-800">
            陸上競技は「出場するまで」が最大の難関？
          </h2>
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 mb-8">
            <h3 className="text-xl font-bold text-red-800 mb-4 flex items-center">
              <span className="text-2xl mr-2">⚠️</span> 陸上は「登録制」のスポーツです
            </h3>
            <p className="text-gray-700 leading-relaxed">
              公式記録が残る大会に出場するには、ただ申し込むだけでは不十分です。<br />
              <strong>「日本陸連への登録」「都道府県陸協への登録」「地区陸協への登録」</strong>、そして各大会ごとのエントリー…。<br />
              これらは社会人ランナーでも初心者でも、公式大会に出るなら避けては通れません。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="text-orange-500 font-bold mb-2">WALL 01</div>
              <h4 className="font-bold text-lg mb-3 text-gray-800">複雑な登録システム</h4>
              <p className="text-sm text-gray-600 leading-relaxed text-justify">
                JAAF-STARTでの個人登録、所属の選択、本人確認、承認待ち…。分厚いPDFマニュアルを片手に、画面とにらめっこする時間が数時間続くことも珍しくありません。
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="text-orange-500 font-bold mb-2">WALL 02</div>
              <h4 className="font-bold text-lg mb-3 text-gray-800">乱立する申込方法</h4>
              <div className="text-xs text-gray-500 space-y-1 mb-3">
                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded mr-1">NANS21V</span>
                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded mr-1">AthleteRanking</span>
                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded mr-1">Excelマクロ</span>
                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded mr-1">独自Webシステム</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed text-justify">
                大会ごとに使うシステムが異なり、支払い方法（銀行振込・現金書留など）もバラバラ。前回覚えたやり方が、次の大会では一切通用しません。
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="text-orange-500 font-bold mb-2">WALL 03</div>
              <h4 className="font-bold text-lg mb-3 text-gray-800">膨大な時間の損失</h4>
              <p className="text-sm text-gray-600 leading-relaxed text-justify font-bold">
                慣れた人でも15分、初心者は調べるところから始めて2時間。
              </p>
              <p className="text-sm text-gray-600 leading-relaxed text-justify mt-2 font-semibold text-red-600">
                1回のエントリーに2時間以上奪われることもあります。
              </p>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <div className="inline-block bg-gray-800 text-white px-8 py-4 rounded-full text-lg font-bold">
              その煩わしい事務手続き、私たちがすべて代行します。
            </div>
          </div>
        </section>

        {/* Introduction */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">エレファントとは</h2>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
            <p className="text-blue-800 font-semibold">📍 北海道限定の陸上クラブです</p>
          </div>
          <div className="prose max-w-none text-gray-600">
            <p className="text-lg leading-relaxed mb-4">
              陸上競技者のための<strong>陸連登録代行</strong>と<strong>大会申込代行</strong>を行う陸上クラブです。
              煩雑な登録手続きやエントリー手続きを代行し、競技に専念できる環境を提供します。
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
                料金には、<strong>大会参加料</strong>や<strong>陸連登録費用</strong>が最初からすべて含まれています。
              </p>
              <p className="bg-white/20 py-2 px-4 rounded-lg font-bold">
                大会のたびに参加料を払ったり、陸連登録費用を別途払う必要はありません！
              </p>
            </div>
          </div>

          {/* Full Support Plans Group */}
          <div className="max-w-6xl mx-auto mb-16">
            <h3 className="text-2xl font-bold mb-8 text-gray-800 border-l-4 border-orange-500 pl-4">
              陸連登録・大会申込 フルサポートプラン
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 入門プラン */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-6 shadow-lg relative flex flex-col">
                <div className="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  初年度限定
                </div>
                <h3 className="text-2xl font-bold text-green-700 mb-2">入門プラン</h3>
                <div className="flex items-baseline mb-1">
                  <span className="text-4xl font-bold text-gray-800">¥9,000</span>
                  <span className="text-gray-600 ml-1">/年</span>
                </div>
                <p className="text-sm text-green-600 font-bold mb-4">登録料・参加料込み</p>
                <div className="space-y-2 text-gray-700 mb-8 flex-grow">
                  <p className="flex items-center font-bold text-green-700">
                    <span className="mr-2">✓</span> 1大会エントリーまで
                  </p>
                  <p className="flex items-center">
                    <span className="mr-2">✓</span> 陸連登録代行
                  </p>
                </div>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSduafqq4D5dA6btXfcf9PAYnhKciRcZSDLg4J1HSqWwbqanBQ/viewform?usp=pp_url&entry.168100395=%E5%85%A5%E9%96%80%E3%83%97%E3%83%A9%E3%83%B3%E2%80%BB%E5%88%9D%E5%B9%B4%E5%BA%A6%E9%99%90%E5%AE%9A"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors"
                >
                  このプランで申し込む
                </a>
              </div>

              {/* 単発プラン */}
              <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-lg flex flex-col">
                <h3 className="text-2xl font-bold text-gray-700 mb-2">単発プラン</h3>
                <div className="flex items-baseline mb-1">
                  <span className="text-4xl font-bold text-gray-800">¥15,000</span>
                  <span className="text-gray-600 ml-1">/年</span>
                </div>
                <p className="text-sm text-gray-600 font-bold mb-4">登録料・参加料込み</p>
                <div className="space-y-2 text-gray-700 mb-8 flex-grow">
                  <p className="flex items-center font-bold text-gray-700">
                    <span className="mr-2">✓</span> 1大会エントリーまで
                  </p>
                  <p className="flex items-center">
                    <span className="mr-2">✓</span> 陸連登録代行
                  </p>
                </div>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSduafqq4D5dA6btXfcf9PAYnhKciRcZSDLg4J1HSqWwbqanBQ/viewform?usp=pp_url&entry.168100395=%E5%8D%98%E7%99%BA%E3%83%97%E3%83%A9%E3%83%B3"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center bg-gray-700 text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  このプランで申し込む
                </a>
              </div>

              {/* ライトプラン */}
              <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-lg flex flex-col">
                <h3 className="text-2xl font-bold text-blue-700 mb-2">ライトプラン</h3>
                <div className="flex items-baseline mb-1">
                  <span className="text-4xl font-bold text-gray-800">¥20,000</span>
                  <span className="text-gray-600 ml-1">/年</span>
                </div>
                <p className="text-sm text-blue-600 font-bold mb-4">登録料・参加料込み</p>
                <div className="space-y-2 text-gray-700 mb-8 flex-grow">
                  <p className="flex items-center font-bold text-blue-600 text-lg">
                    <span className="mr-2">✓</span> 3大会エントリーまで
                  </p>
                  <p className="flex items-center">
                    <span className="mr-2">✓</span> 陸連登録代行
                  </p>
                </div>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSduafqq4D5dA6btXfcf9PAYnhKciRcZSDLg4J1HSqWwbqanBQ/viewform?usp=pp_url&entry.168100395=%E3%83%A9%E3%82%A4%E3%83%88%E3%83%97%E3%83%A9%E3%83%B3"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  このプランで申し込む
                </a>
              </div>

              {/* スタンダードプラン */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-300 rounded-xl p-6 shadow-lg flex flex-col">
                <h3 className="text-2xl font-bold text-orange-700 mb-2">スタンダードプラン</h3>
                <div className="flex items-baseline mb-1">
                  <span className="text-4xl font-bold text-gray-800">¥40,000</span>
                  <span className="text-gray-600 ml-1">/年</span>
                </div>
                <p className="text-sm text-orange-600 font-bold mb-4">登録料・参加料込み</p>
                <div className="space-y-2 text-gray-700 mb-8 flex-grow">
                  <p className="flex items-center font-bold text-orange-600 text-lg">
                    <span className="mr-2">✓</span> 8大会エントリーまで
                  </p>
                  <p className="flex items-center">
                    <span className="mr-2">✓</span> 陸連登録代行
                  </p>
                </div>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSduafqq4D5dA6btXfcf9PAYnhKciRcZSDLg4J1HSqWwbqanBQ/viewform?usp=pp_url&entry.168100395=%E3%82%B9%E3%82%BF%E3%83%B3%E3%83%80%E3%83%BC%E3%83%89%E3%83%97%E3%83%A9%E3%83%B3"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center bg-orange-600 text-white font-bold py-3 rounded-lg hover:bg-orange-700 transition-colors"
                >
                  このプランで申し込む
                </a>
              </div>

              {/* プレミアムプラン */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-xl p-6 shadow-lg md:col-span-2 lg:col-span-1 flex flex-col">
                <h3 className="text-2xl font-bold text-purple-700 mb-2">プレミアムプラン</h3>
                <div className="flex items-baseline mb-1">
                  <span className="text-4xl font-bold text-gray-800">¥200,000</span>
                  <span className="text-gray-600 ml-1">/年</span>
                </div>
                <p className="text-sm text-purple-600 font-bold mb-4">登録料・参加料込み</p>
                <div className="space-y-2 text-gray-700 mb-8 flex-grow">
                  <p className="flex items-center font-bold text-purple-600 text-lg">
                    <span className="mr-2">✓</span> 50大会エントリーまで
                  </p>
                  <p className="flex items-center">
                    <span className="mr-2">✓</span> 陸連登録代行
                  </p>
                </div>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSduafqq4D5dA6btXfcf9PAYnhKciRcZSDLg4J1HSqWwbqanBQ/viewform?usp=pp_url&entry.168100395=%E3%83%97%E3%83%AC%E3%83%9F%E3%82%A2%E3%83%A0%E3%83%97%E3%83%A9%E3%83%B3"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  このプランで申し込む
                </a>
              </div>
            </div>
          </div>

          {/* Entry Only Plans Group */}
          <div className="max-w-6xl mx-auto mb-16">
            <h3 className="text-2xl font-bold mb-4 text-gray-800 border-l-4 border-gray-400 pl-4">
              大会申込のみプラン（陸連登録はご自身で行う方）
            </h3>
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 rounded shadow-sm">
              <p className="text-red-700 text-sm font-bold leading-relaxed">
                ⚠️ こちらのプランは当クラブでの陸連登録代行は行いません。既に個人または他団体で今年度の陸連登録がお済みの方のみご利用いただけます。必ずご自身で登録を済ませてからお申し込みください。
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 入門プラン（なし） */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col relative">
                <div className="absolute top-4 right-4 bg-gray-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  初年度限定
                </div>
                <h3 className="text-xl font-bold text-gray-700 mb-2">入門プラン<br /><span className="text-sm font-normal">（陸連登録なし）</span></h3>
                <div className="flex items-baseline mb-1">
                  <span className="text-3xl font-bold text-gray-800">¥3,000</span>
                  <span className="text-gray-600 ml-1">/年</span>
                </div>
                <p className="text-sm text-gray-500 mb-1">一人一回まで</p>
                <p className="text-xs text-gray-500 mb-4">大会参加料込み</p>
                <div className="space-y-2 text-sm text-gray-600 mb-8 flex-grow">
                  <p className="flex items-center font-bold">
                    <span className="mr-2">✓</span> 1大会エントリーまで
                  </p>
                  <p className="flex items-center text-gray-400 italic">
                    <span className="mr-2">×</span> 陸連登録なし（各自）
                  </p>
                </div>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSduafqq4D5dA6btXfcf9PAYnhKciRcZSDLg4J1HSqWwbqanBQ/viewform?usp=pp_url&entry.168100395=%E5%85%A5%E9%96%80%E3%83%97%E3%83%A9%E3%83%B3%E2%80%BB%E5%88%9D%E5%B9%B4%E5%BA%A6%E9%99%90%E5%AE%9A(%E9%99%B8%E9%80%A3%E7%99%BB%E9%8C%B2%E3%81%AA%E3%81%97)"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center border-2 border-gray-400 text-gray-600 font-bold py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  このプランで申し込む
                </a>
              </div>

              {/* 単発プラン（なし） */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col">
                <h3 className="text-xl font-bold text-gray-700 mb-2">単発プラン<br /><span className="text-sm font-normal">（陸連登録なし）</span></h3>
                <div className="flex items-baseline mb-1">
                  <span className="text-3xl font-bold text-gray-800">¥5,000</span>
                  <span className="text-gray-600 ml-1">/年</span>
                </div>
                <p className="text-xs text-gray-500 mb-4">大会参加料込み</p>
                <div className="space-y-2 text-sm text-gray-600 mb-8 flex-grow">
                  <p className="flex items-center font-bold">
                    <span className="mr-2">✓</span> 1大会エントリーまで
                  </p>
                  <p className="flex items-center text-gray-400 italic">
                    <span className="mr-2">×</span> 陸連登録なし（各自）
                  </p>
                </div>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSduafqq4D5dA6btXfcf9PAYnhKciRcZSDLg4J1HSqWwbqanBQ/viewform?usp=pp_url&entry.168100395=%E5%8D%98%E7%99%BA%E3%83%97%E3%83%A9%E3%83%B3(%E9%99%B8%E9%80%A3%E7%99%BB%E9%8C%B2%E3%81%AA%E3%81%97)"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center border-2 border-gray-400 text-gray-600 font-bold py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  このプランで申し込む
                </a>
              </div>

              {/* ライトプラン（なし） */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col">
                <h3 className="text-xl font-bold text-gray-700 mb-2">ライトプラン<br /><span className="text-sm font-normal">（陸連登録なし）</span></h3>
                <div className="flex items-baseline mb-1">
                  <span className="text-3xl font-bold text-gray-800">¥12,000</span>
                  <span className="text-gray-600 ml-1">/年</span>
                </div>
                <p className="text-xs text-gray-500 mb-4">大会参加料込み</p>
                <div className="space-y-2 text-sm text-gray-600 mb-8 flex-grow">
                  <p className="flex items-center font-bold">
                    <span className="mr-2">✓</span> 3大会エントリーまで
                  </p>
                  <p className="flex items-center text-gray-400 italic">
                    <span className="mr-2">×</span> 陸連登録なし（各自）
                  </p>
                </div>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSduafqq4D5dA6btXfcf9PAYnhKciRcZSDLg4J1HSqWwbqanBQ/viewform?usp=pp_url&entry.168100395=%E3%83%A9%E3%82%A4%E3%83%88%E3%83%97%E3%83%A9%E3%83%B3(%E9%99%B8%E9%80%A3%E7%99%BB%E9%8C%B2%E3%81%AA%E3%81%97)"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center border-2 border-gray-400 text-gray-600 font-bold py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  このプランで申し込む
                </a>
              </div>

              {/* スタンダードプラン（なし） */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col">
                <h3 className="text-xl font-bold text-gray-700 mb-2">スタンダードプラン<br /><span className="text-sm font-normal">（陸連登録なし）</span></h3>
                <div className="flex items-baseline mb-1">
                  <span className="text-3xl font-bold text-gray-800">¥30,000</span>
                  <span className="text-gray-600 ml-1">/年</span>
                </div>
                <p className="text-xs text-gray-500 mb-4">大会参加料込み</p>
                <div className="space-y-2 text-sm text-gray-600 mb-8 flex-grow">
                  <p className="flex items-center font-bold">
                    <span className="mr-2">✓</span> 8大会エントリーまで
                  </p>
                  <p className="flex items-center text-gray-400 italic">
                    <span className="mr-2">×</span> 陸連登録なし（各自）
                  </p>
                </div>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSduafqq4D5dA6btXfcf9PAYnhKciRcZSDLg4J1HSqWwbqanBQ/viewform?usp=pp_url&entry.168100395=%E3%82%B9%E3%82%BF%E3%83%B3%E3%83%80%E3%83%BC%E3%83%89%E3%83%97%E3%83%A9%E3%83%B3(%E9%99%B8%E9%80%A3%E7%99%BB%E9%8C%B2%E3%81%AA%E3%81%97)"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center border-2 border-gray-400 text-gray-600 font-bold py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  このプランで申し込む
                </a>
              </div>

              {/* プレミアムプラン（なし） */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col md:col-span-2 lg:col-span-1">
                <h3 className="text-xl font-bold text-gray-700 mb-2">プレミアムプラン<br /><span className="text-sm font-normal">（陸連登録なし）</span></h3>
                <div className="flex items-baseline mb-1">
                  <span className="text-3xl font-bold text-gray-800">¥190,000</span>
                  <span className="text-gray-600 ml-1">/年</span>
                </div>
                <p className="text-xs text-gray-500 mb-4">大会参加料込み</p>
                <div className="space-y-2 text-sm text-gray-600 mb-8 flex-grow">
                  <p className="flex items-center font-bold">
                    <span className="mr-2">✓</span> 50大会エントリーまで
                  </p>
                  <p className="flex items-center text-gray-400 italic">
                    <span className="mr-2">×</span> 陸連登録なし（各自）
                  </p>
                </div>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSduafqq4D5dA6btXfcf9PAYnhKciRcZSDLg4J1HSqWwbqanBQ/viewform?usp=pp_url&entry.168100395=%E3%83%97%E3%83%AC%E3%83%9F%E3%82%A2%E3%83%A0%E3%83%97%E3%83%A9%E3%83%B3(%E9%99%B8%E9%80%A3%E7%99%BB%E9%8C%B2%E3%81%AA%E3%81%97)"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center border-2 border-gray-400 text-gray-600 font-bold py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  このプランで申し込む
                </a>
              </div>
            </div>
          </div>

          {/* 追加オプション */}
          <div className="max-w-3xl mx-auto mb-16">
            <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-6 shadow-md">
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">追加オプション</h3>
              
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <div className="flex-1">
                  <p className="text-xl font-bold text-gray-800">1大会追加</p>
                  <p className="text-orange-600 font-bold text-2xl">¥5,000<span className="text-sm text-gray-600 font-normal">/大会</span></p>
                </div>
                <div className="flex-1 text-sm text-gray-600 font-bold text-right">
                  エントリー種目数問わず！<br />
                  <span className="font-normal text-xs text-gray-500">
                    各プランの上限回数を超えて大会に出場したくなった場合のオプションです。<strong>（大会参加料込み）</strong>
                  </span>
                </div>
              </div>

              <div className="bg-white p-4 rounded border border-gray-200">
                <p className="text-sm font-bold text-gray-700 mb-2">💡 例えばこんな時に：</p>
                <p className="text-sm text-gray-600 leading-relaxed text-justify">
                  「入門プラン（1大会まで）で登録したけど、調子が良いので<strong>2大会目も出場したい！</strong>」<br />
                  そんな時は＋5,000円で2大会目のエントリー代行も承ります。
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-blue-50 border-l-4 border-blue-500 rounded p-6 shadow-sm text-center">
              <h3 className="font-bold text-gray-800 mb-2 text-lg">🏃 年間サービスとして</h3>
              <p className="text-gray-700 leading-relaxed">
                エレファント陸上クラブの各プランは、1年間を通じてあなたの競技生活をトータルでサポートする<strong>年間サービス</strong>です。事務手続きのストレスから解放され、最高のコンディションで大会に臨んでください。
              </p>
            </div>

            <div className="bg-orange-50 border-l-4 border-orange-500 rounded p-8 shadow-md text-center">
              <h3 className="font-bold text-gray-800 mb-4 text-xl">📧 お申し込み方法</h3>
              <p className="text-gray-700 mb-6 text-lg font-medium">
                専用フォームから簡単にお申し込みいただけます。
              </p>
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSduafqq4D5dA6btXfcf9PAYnhKciRcZSDLg4J1HSqWwbqanBQ/viewform?usp=sf_link"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-orange-600 text-white font-bold py-4 px-10 rounded-full text-lg hover:bg-orange-700 transition-colors shadow-lg"
              >
                お申し込みフォームを開く
              </a>
              <p className="mt-8 text-sm text-gray-500">
                ご質問等は <strong className="text-gray-700">athletics.elephant.club@gmail.com</strong> までお気軽にご連絡ください。
              </p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg max-w-4xl mx-auto mt-8">
            <h3 className="font-semibold text-gray-800 mb-2">💳 決済手段</h3>
            <p className="text-gray-600 text-sm">銀行振込・PayPayに対応</p>
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            ※ お問い合わせ: athletics.elephant.club@gmail.com
          </p>
        </section>
      </div>
    </div>
  );
}
