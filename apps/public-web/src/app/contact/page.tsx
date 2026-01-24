import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "お問い合わせ | ELEPHANT 陸上クラブ",
  description: "ELEPHANT陸上クラブへのお問い合わせページです。入会に関するご質問や体験練習のお申し込みなど、お気軽にご連絡ください。",
};

export default function ContactPage() {
  return (
    <div className="py-16">
      {/* Page Header */}
      <div className="bg-orange-500 text-white py-12 mb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-bold">お問い合わせ</h1>
          <p className="mt-2 text-orange-100">Contact</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Introduction */}
        <div className="mb-12 text-center">
          <p className="text-gray-600">
            入会に関するご質問、体験練習のお申し込みなど、
            <br className="hidden sm:inline" />
            お気軽にお問い合わせください。
          </p>
        </div>

        {/* Contact Form */}
        <form className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              お名前 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
              placeholder="山田 太郎"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              電話番号
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
              placeholder="090-1234-5678"
            />
          </div>

          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              お問い合わせ種別 <span className="text-red-500">*</span>
            </label>
            <select
              id="category"
              name="category"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
            >
              <option value="">選択してください</option>
              <option value="trial">体験練習のお申し込み</option>
              <option value="join">入会に関するご質問</option>
              <option value="event">イベントについて</option>
              <option value="other">その他</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="message"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              お問い合わせ内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              name="message"
              rows={6}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition resize-none"
              placeholder="お問い合わせ内容をご入力ください"
            />
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="privacy"
              name="privacy"
              required
              className="mt-1"
            />
            <label htmlFor="privacy" className="text-sm text-gray-600">
              個人情報の取り扱いに同意します
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
          >
            送信する
          </button>
        </form>

        {/* Alternative Contact */}
        <div className="mt-12 pt-12 border-t border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
            その他のお問い合わせ方法
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <svg
                className="w-8 h-8 text-orange-500 mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <h3 className="font-semibold text-gray-800 mb-1">メール</h3>
              <p className="text-gray-600">info@elephant-track.com</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <svg
                className="w-8 h-8 text-orange-500 mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                />
              </svg>
              <h3 className="font-semibold text-gray-800 mb-1">SNS</h3>
              <p className="text-gray-600">DMでもお気軽にどうぞ</p>
            </div>
          </div>
        </div>

        {/* Note */}
        <p className="mt-8 text-sm text-gray-500 text-center">
          お問い合わせいただいた内容は、通常2〜3営業日以内に返信いたします。
          <br />
          返信がない場合は、迷惑メールフォルダをご確認ください。
        </p>
      </div>
    </div>
  );
}
