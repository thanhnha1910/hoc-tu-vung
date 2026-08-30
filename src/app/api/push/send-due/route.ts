import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isExpiredPushSubscription, sendPush } from "@/lib/push-server";
import { isSubscriptionDue } from "@/lib/push-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
  preferred_hour: number;
  last_notified_on: string | null;
}

function hasValidCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const received = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

async function sendScheduledNotifications(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Thiếu cấu hình Supabase server" },
      { status: 503 },
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin
    .from("push_subscriptions")
    .select(
      "id,endpoint,p256dh,auth,timezone,preferred_hour,last_notified_on",
    )
    .eq("enabled", true)
    .limit(1000);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  const due = ((data ?? []) as SubscriptionRow[])
    .map((row) => ({ row, schedule: isSubscriptionDue(row, now) }))
    .filter(({ schedule }) => schedule.due);
  let sent = 0;
  let expired = 0;
  let failed = 0;

  for (let offset = 0; offset < due.length; offset += 20) {
    const batch = due.slice(offset, offset + 20);
    await Promise.all(
      batch.map(async ({ row, schedule }) => {
        try {
          await sendPush(row, {
            title: "Đến giờ ôn từ rồi ✨",
            body: "Mở một phiên flashcard 10 phút để giữ chuỗi ghi nhớ hôm nay.",
            url: "/study/daily",
          });
          await admin
            .from("push_subscriptions")
            .update({ last_notified_on: schedule.localDate })
            .eq("id", row.id);
          sent += 1;
        } catch (pushError) {
          if (isExpiredPushSubscription(pushError)) {
            await admin.from("push_subscriptions").delete().eq("id", row.id);
            expired += 1;
          } else {
            console.error("Scheduled push failed", pushError);
            failed += 1;
          }
        }
      }),
    );
  }

  return NextResponse.json({
    checked: data?.length ?? 0,
    due: due.length,
    sent,
    expired,
    failed,
  });
}

export async function GET(request: Request) {
  return sendScheduledNotifications(request);
}

export async function POST(request: Request) {
  return sendScheduledNotifications(request);
}
