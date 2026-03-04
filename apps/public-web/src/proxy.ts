import { clerkMiddleware } from "@clerk/nextjs/server";

// サイトは全ページ公開。エントリー（決済）関連のみ準備中。
// ブロックはEntryButton UI + API側で実施。
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
