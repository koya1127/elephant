"use client";

import Link from "next/link";
import { useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";

const navItems = [
  { href: "/", label: "ホーム" },
  { href: "/events", label: "大会一覧" },
  { href: "/venues", label: "競技場マップ" },
  { href: "/slopes", label: "坂ダッシュ" },
];

function isAdminUser(user: { publicMetadata: Record<string, unknown> }): boolean {
  return user.publicMetadata?.role === "admin";
}

function MyPageLink() {
  return (
    <Link
      href="/mypage"
      className="text-gray-700 hover:text-orange-600 transition-colors font-medium"
    >
      マイページ
    </Link>
  );
}

function AdminLink() {
  const { user, isLoaded } = useUser();
  if (!isLoaded || !user) return null;
  if (!isAdminUser(user as { publicMetadata: Record<string, unknown> })) return null;
  return (
    <Link
      href="/admin"
      className="px-3 py-1.5 text-sm font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
    >
      管理
    </Link>
  );
}

function JoinLink() {
  const { user, isLoaded } = useUser();
  if (!isLoaded || !user) return null;
  const status = (user.publicMetadata as Record<string, unknown>)?.memberStatus;
  if (status === "active") return null;
  return (
    <Link
      href="/join"
      className="px-3 py-1.5 text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
    >
      入会する
    </Link>
  );
}

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl md:text-3xl font-bold text-orange-600 tracking-tighter">エレファント</span>
            <span className="text-sm text-gray-600 hidden sm:inline font-bold">陸上クラブ</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-gray-700 hover:text-orange-600 transition-colors font-medium"
              >
                {item.label}
              </Link>
            ))}
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors">
                  ログイン
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <JoinLink />
              <MyPageLink />
              <AdminLink />
              <UserButton />
            </SignedIn>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-3">
            <SignedIn>
              <UserButton />
            </SignedIn>
            <button
              className="p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="メニューを開く"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 border-t">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block py-2 text-gray-700 hover:text-orange-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <SignedIn>
              <Link
                href="/mypage"
                className="block py-2 text-gray-700 hover:text-orange-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                マイページ
              </Link>
              <div onClick={() => setIsMenuOpen(false)}>
                <AdminLink />
              </div>
              <div onClick={() => setIsMenuOpen(false)}>
                <JoinLink />
              </div>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  className="mt-2 w-full px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  ログイン
                </button>
              </SignInButton>
            </SignedOut>
          </nav>
        )}
      </div>
    </header>
  );
}
