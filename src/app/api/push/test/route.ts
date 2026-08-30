import { NextResponse } from "next/server";
import { isExpiredPushSubscription, sendPush } from "@/lib/push-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function POST() {
  const sb = await createSupabaseServerClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { data, error } = await sb
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("enabled", true);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as SubscriptionRow[];
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Thiết bị này chưa bật thông báo" },
      { status: 404 },
    );
  }

  let sent = 0;
  for (const row of rows) {
    try {
      await sendPush(row, {
        title: "Thông báo đã hoạt động 🎉",
        body: "Mỗi ngày ứng dụng sẽ nhắc bạn mở phiên flashcard 10 phút.",
        url: "/study/daily",
      });
      sent += 1;
    } catch (pushError) {
      if (isExpiredPushSubscription(pushError)) {
        await sb.from("push_subscriptions").delete().eq("id", row.id);
        continue;
      }
      const message =
        pushError instanceof Error
          ? pushError.message
          : "Không gửi được thông báo";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ sent });
}
