import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { addEntry, getUserEntries, readEntries } from "@/lib/entry-storage";
import type { Entry } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await getUserEntries(userId);
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { eventId, eventName, eventDate, disciplines } = body as {
    eventId: string;
    eventName: string;
    eventDate: string;
    disciplines: string[];
  };

  if (!eventId || !eventName || !eventDate) {
    return NextResponse.json(
      { error: "eventId, eventName, eventDate は必須です" },
      { status: 400 }
    );
  }

  // Clerk metadata チェック
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const meta = user.publicMetadata as Record<string, unknown>;
  const memberStatus = meta?.memberStatus as string | undefined;
  const entryLimit = (meta?.entryLimit as number) || 0;
  const entriesUsed = (meta?.entriesUsed as number) || 0;

  if (memberStatus !== "active") {
    return NextResponse.json(
      { error: "会員ステータスがactiveではありません" },
      { status: 400 }
    );
  }

  if (entriesUsed >= entryLimit) {
    return NextResponse.json(
      { error: "エントリー上限に達しています" },
      { status: 400 }
    );
  }

  // 重複チェック
  const allEntries = await readEntries();
  const duplicate = allEntries.find(
    (e) => e.userId === userId && e.eventId === eventId
  );
  if (duplicate) {
    return NextResponse.json(
      { error: "この大会には既にエントリー済みです" },
      { status: 400 }
    );
  }

  // エントリー作成
  const entry: Entry = {
    id: crypto.randomUUID(),
    userId,
    eventId,
    eventName,
    eventDate,
    disciplines,
    status: "submitted",
    createdAt: new Date().toISOString(),
  };

  await addEntry(entry);

  // entriesUsed を +1
  const newEntriesUsed = entriesUsed + 1;
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...meta,
      entriesUsed: newEntriesUsed,
    },
  });

  return NextResponse.json({
    entry,
    remaining: entryLimit - newEntriesUsed,
  });
}
