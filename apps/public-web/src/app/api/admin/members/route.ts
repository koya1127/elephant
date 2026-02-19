import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin";
import { clerkClient } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function GET() {
  const result = await checkAdmin();
  if (!result.ok) return result.response;

  const clerk = await clerkClient();
  const { data: users } = await clerk.users.getUserList({ limit: 100 });

  const members = users.map((u) => {
    const meta = u.publicMetadata as Record<string, unknown>;
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.emailAddresses[0]?.emailAddress ?? "",
      memberStatus: meta?.memberStatus ?? null,
      planName: meta?.planName ?? null,
      entryLimit: (meta?.entryLimit as number) ?? 0,
      entriesUsed: (meta?.entriesUsed as number) ?? 0,
      createdAt: u.createdAt,
    };
  });

  return NextResponse.json({ members });
}
