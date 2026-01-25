import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold text-orange-500 mb-4">
              エレファント 陸上クラブ
            </h3>
            <p className="text-gray-400">
              北海道限定の
              <br />
              陸上大会申込代行クラブ
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">リンク</h4>
            <ul className="space-y-2 text-gray-400">
              <li>
                <Link href="/" className="hover:text-orange-500 transition-colors">
                  ホーム
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">お問い合わせ</h4>
            <ul className="space-y-2 text-gray-400">
              <li>メール: athletics.elephant.club@gmail.com</li>
              <li>活動拠点: 北海道</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500">
          <p>&copy; {new Date().getFullYear()} エレファント 陸上クラブ. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
