import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/** サーバーサイド: admin認証チェック。失敗時はNextResponse返却 */
export async function checkAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const { userId } = await auth();
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const meta = user.publicMetadata as Record<string, unknown>;

  if (meta?.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, userId };
}
