import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "エレファント陸上クラブ | 北海道の陸上大会エントリー代行",
  description:
    "北海道の陸上大会エントリーを代行するクラブです。面倒な申込手続きをすべてお任せ。参加費＋手数料¥1,500の都度払いで、1大会から気軽に利用できます。",
  openGraph: {
    title: "エレファント陸上クラブ | 北海道の陸上大会エントリー代行",
    description:
      "北海道の陸上大会エントリーを代行。面倒な申込手続きをすべてお任せ。参加費＋手数料¥1,500の都度払い。",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SportsOrganization",
  name: "エレファント陸上クラブ",
  description:
    "北海道限定の陸上大会エントリー代行クラブ。大会申込の面倒な手続きをすべて代行します。",
  sport: "Track and Field",
  email: "athletics.elephant.club@gmail.com",
  areaServed: {
    "@type": "State",
    name: "北海道",
    containedInPlace: { "@type": "Country", name: "Japan" },
  },
};

export default function HomePage() {
  return (
    <div className="py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Hero */}
      <div className="bg-orange-500 text-white py-12 mb-12 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-5xl font-bold">
            エレファント陸上クラブ
          </h1>
          <p className="mt-3 text-orange-100 text-lg md:text-xl">
            大会エントリーの面倒、ぜんぶ代行します。
          </p>
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
              <span className="text-2xl mr-2">&#9888;&#65039;</span>{" "}
              陸上は「登録制」のスポーツです
            </h3>
            <p className="text-gray-700 leading-relaxed">
              公式記録が残る大会に出場するには、ただ申し込むだけでは不十分です。
              <br />
              <strong>
                「日本陸連への登録」「都道府県陸協への登録」「地区陸協への登録」
              </strong>
              、そして各大会ごとのエントリー…。
              <br />
              これらは社会人ランナーでも初心者でも、公式大会に出るなら避けては通れません。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="text-orange-500 font-bold mb-2">WALL 01</div>
              <h4 className="font-bold text-lg mb-3 text-gray-800">
                複雑な登録システム
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed text-justify">
                JAAF-STARTでの個人登録、所属の選択、本人確認、承認待ち…。分厚いPDFマニュアルを片手に、画面とにらめっこする時間が数時間続くことも珍しくありません。
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="text-orange-500 font-bold mb-2">WALL 02</div>
              <h4 className="font-bold text-lg mb-3 text-gray-800">
                乱立する申込方法
              </h4>
              <div className="text-xs text-gray-500 space-y-1 mb-3">
                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded mr-1">
                  NANS21V
                </span>
                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded mr-1">
                  AthleteRanking
                </span>
                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded mr-1">
                  Excelマクロ
                </span>
                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded mr-1">
                  独自Webシステム
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed text-justify">
                大会ごとに使うシステムが異なり、支払い方法（銀行振込・現金書留など）もバラバラ。前回覚えたやり方が、次の大会では一切通用しません。
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="text-orange-500 font-bold mb-2">WALL 03</div>
              <h4 className="font-bold text-lg mb-3 text-gray-800">
                膨大な時間の損失
              </h4>
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
          <h2 className="text-2xl font-bold mb-6 text-gray-800">
            エレファントとは
          </h2>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
            <p className="text-blue-800 font-semibold">
              &#128205; 北海道限定の陸上クラブです
            </p>
          </div>
          <div className="prose max-w-none text-gray-600">
            <p className="text-lg leading-relaxed mb-4">
              陸上競技者のための<strong>大会エントリー代行</strong>
              に特化した陸上クラブです。
              煩雑なエントリー手続きを代行し、競技に専念できる環境を提供します。
            </p>
            <p className="text-lg leading-relaxed">
              練習会や交流会は開催せず、事務手続きの利便性向上に特化したクラブ運営を行っています。
              クラブユニフォームもありません。
              出たい大会を選んで申し込むだけ。あとはこちらで全てやります。
            </p>
          </div>
        </section>

        {/* How to Use - Step by Step */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">
            ご利用の流れ
          </h2>
          <div className="grid md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="bg-orange-500 text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-lg mb-2">会員登録</h3>
              <p className="text-gray-600 text-sm">
                無料のアカウント作成のみ
              </p>
            </div>
            <div className="text-center relative">
              <div className="hidden md:block absolute top-8 left-0 w-full h-0.5 bg-orange-200 -z-10"></div>
              <div className="bg-orange-500 text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-lg mb-2">大会を選ぶ</h3>
              <p className="text-gray-600 text-sm">
                大会一覧から出たい大会と種目を選択
              </p>
            </div>
            <div className="text-center relative">
              <div className="hidden md:block absolute top-8 left-0 w-full h-0.5 bg-orange-200 -z-10"></div>
              <div className="bg-orange-500 text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-lg mb-2">お支払い</h3>
              <p className="text-gray-600 text-sm">
                クレジットカードで都度決済
              </p>
            </div>
            <div className="text-center relative">
              <div className="hidden md:block absolute top-8 left-0 w-full h-0.5 bg-orange-200 -z-10"></div>
              <div className="bg-orange-500 text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="font-semibold text-lg mb-2">大会に出場</h3>
              <p className="text-gray-600 text-sm">
                エントリー手続きは全て代行。競技に集中！
              </p>
            </div>
          </div>
        </section>

        {/* Service Features */}
        <section className="mb-16 bg-orange-50 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">
            クラブの特徴
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-3">&#128221;</div>
              <h3 className="text-xl font-semibold mb-3 text-orange-600">
                ワンストップ申込
              </h3>
              <p className="text-gray-600">
                大会エントリーを全て代行。フォーム入力や書類準備は不要です。
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-3">&#128176;</div>
              <h3 className="text-xl font-semibold mb-3 text-orange-600">
                都度払いでシンプル
              </h3>
              <p className="text-gray-600">
                年会費なし。大会ごとに参加費＋手数料&#165;1,500だけ。1大会から利用できます。
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="text-3xl mb-3">&#128197;</div>
              <h3 className="text-xl font-semibold mb-3 text-orange-600">
                北海道全域の大会情報
              </h3>
              <p className="text-gray-600">
                北海道内の陸上大会スケジュールを自動収集。出たい大会を見つけやすい。
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-8 text-gray-800 text-center">
            料金
          </h2>

          {/* Simple pricing card */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-300 rounded-2xl p-8 shadow-lg">
              <div className="text-center mb-6">
                <p className="text-sm font-bold text-orange-600 mb-2">
                  都度エントリー制
                </p>
                <p className="text-gray-700 text-lg">
                  年会費・入会金は<strong>一切不要</strong>
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="bg-white rounded-xl p-5 border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800 text-lg">
                        参加費（実費）
                      </p>
                      <p className="text-sm text-gray-500">
                        大会ごとに異なります
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">実費</p>
                  </div>
                </div>

                <div className="flex items-center justify-center text-gray-400 text-2xl">
                  +
                </div>

                <div className="bg-white rounded-xl p-5 border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800 text-lg">
                        手数料
                      </p>
                      <p className="text-sm text-gray-500">
                        エントリー代行・事務手数料
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-orange-600">
                      &#165;1,500
                      <span className="text-sm text-gray-500 font-normal">
                        /1エントリー
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center text-gray-400 text-2xl">
                  +
                </div>

                <div className="bg-white rounded-xl p-5 border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800 text-lg">
                        決済手数料
                      </p>
                      <p className="text-sm text-gray-500">
                        Stripe決済手数料
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">
                      3.6<span className="text-lg">%</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Example calculation */}
              <div className="bg-white rounded-xl p-5 border-2 border-dashed border-orange-300">
                <p className="text-sm font-bold text-orange-600 mb-3">
                  &#128161; 例：参加費 &#165;3,000 の大会の場合
                </p>
                <div className="space-y-1 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>参加費</span>
                    <span>&#165;3,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>手数料</span>
                    <span>&#165;1,500</span>
                  </div>
                  <div className="flex justify-between">
                    <span>決済手数料（3.6%）</span>
                    <span>&#165;168</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2 mt-2 font-bold text-base text-gray-900">
                    <span>合計</span>
                    <span>&#165;4,668</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">
                &#128179; 決済手段
              </h3>
              <p className="text-gray-600 text-sm">
                クレジットカード（Stripe決済）に対応
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-orange-50 border-l-4 border-orange-500 rounded p-8 shadow-md text-center">
              <h3 className="font-bold text-gray-800 mb-4 text-xl">
                まずは大会をチェック
              </h3>
              <p className="text-gray-700 mb-6 text-lg font-medium">
                北海道の陸上大会スケジュールを一覧で確認できます。
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/events"
                  className="inline-block bg-orange-600 text-white font-bold py-4 px-10 rounded-full text-lg hover:bg-orange-700 transition-colors shadow-lg"
                >
                  大会一覧を見る
                </Link>
                <Link
                  href="/join"
                  className="inline-block border-2 border-orange-600 text-orange-600 font-bold py-4 px-10 rounded-full text-lg hover:bg-orange-50 transition-colors"
                >
                  エントリー方法
                </Link>
              </div>
              <p className="mt-8 text-sm text-gray-500">
                ご質問等は{" "}
                <strong className="text-gray-700">
                  athletics.elephant.club@gmail.com
                </strong>{" "}
                までお気軽にご連絡ください。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
