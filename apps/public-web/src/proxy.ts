import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// API routes that need to work without auth (webhooks, cron, etc.)
const isPublicApi = createRouteMatcher([
  "/api/stripe/webhook",
  "/api/admin/health",
]);

// Clerk sign-in/sign-up pages must be accessible
const isAuthPage = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Allow Clerk auth pages
  if (isAuthPage(req)) return;

  // Allow public API routes (webhooks, cron)
  if (isPublicApi(req)) return;

  // All other routes: require admin
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    // Not logged in → redirect to sign-in
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  const role = (sessionClaims?.publicMetadata as Record<string, unknown>)
    ?.role;
  if (role !== "admin") {
    // Logged in but not admin → show maintenance page
    const url = new URL("/maintenance", req.url);
    if (req.nextUrl.pathname !== "/maintenance") {
      return NextResponse.rewrite(url);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
