import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "お知らせ | ELEPHANT 陸上クラブ",
  description: "ELEPHANT陸上クラブからのお知らせ、イベント情報、活動報告などを掲載しています。",
};

const newsData = [
  {
    id: 1,
    date: "2025.01.20",
    category: "お知らせ",
    title: "2025年度 新規メンバー募集中！",
    excerpt:
      "新年度に向けて、新規メンバーを募集しています。体験練習も随時受け付けていますので、お気軽にお問い合わせください。",
  },
  {
    id: 2,
    date: "2025.01.15",
    category: "イベント",
    title: "新年ランを開催しました",
    excerpt:
      "1月3日に恒例の新年ランを開催しました。今年も多くのメンバーが参加し、初日の出を見ながら気持ちよく走ることができました。",
  },
  {
    id: 3,
    date: "2025.01.10",
    category: "大会結果",
    title: "ニューイヤー駅伝観戦レポート",
    excerpt:
      "元日に開催されたニューイヤー駅伝を沿道で応援しました。トップ選手の走りに刺激を受けたメンバーも多かったようです。",
  },
  {
    id: 4,
    date: "2024.12.28",
    category: "お知らせ",
    title: "年末年始の練習スケジュール",
    excerpt:
      "年末年始期間中の練習スケジュールをお知らせします。12月29日〜1月3日は通常練習はお休みとなります。",
  },
  {
    id: 5,
    date: "2024.12.20",
    category: "イベント",
    title: "忘年会を開催しました",
    excerpt:
      "12月15日に忘年会を開催しました。今年一年の活動を振り返り、来年の目標を語り合う楽しい会となりました。",
  },
  {
    id: 6,
    date: "2024.12.10",
    category: "大会結果",
    title: "湘南国際マラソン参加レポート",
    excerpt:
      "12月1日に開催された湘南国際マラソンにクラブから10名が参加。うち3名がサブ4を達成しました。",
  },
];

const categoryColors: Record<string, string> = {
  お知らせ: "bg-blue-100 text-blue-800",
  イベント: "bg-green-100 text-green-800",
  大会結果: "bg-orange-100 text-orange-800",
};

export default function NewsPage() {
  return (
    <div className="py-16">
      {/* Page Header */}
      <div className="bg-orange-500 text-white py-12 mb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-bold">お知らせ</h1>
          <p className="mt-2 text-orange-100">News</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* News List */}
        <div className="space-y-6">
          {newsData.map((news) => (
            <article
              key={news.id}
              className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <time className="text-sm text-gray-500">{news.date}</time>
                <span
                  className={`text-xs px-2 py-1 rounded ${categoryColors[news.category] || "bg-gray-100 text-gray-800"}`}
                >
                  {news.category}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                {news.title}
              </h2>
              <p className="text-gray-600">{news.excerpt}</p>
            </article>
          ))}
        </div>

        {/* Pagination Placeholder */}
        <div className="mt-12 flex justify-center">
          <nav className="flex items-center gap-2">
            <span className="px-4 py-2 bg-orange-500 text-white rounded">1</span>
            <Link
              href="#"
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              2
            </Link>
            <Link
              href="#"
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              3
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
