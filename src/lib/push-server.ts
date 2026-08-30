import webPush, { WebPushError, type PushSubscription } from "web-push";

export interface StoredPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("Web Push chưa được cấu hình trên máy chủ");
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
}

export async function sendPush(
  subscription: StoredPushSubscription,
  payload: { title: string; body: string; url: string },
) {
  configureWebPush();
  const target: PushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
  return webPush.sendNotification(target, JSON.stringify(payload), {
    TTL: 60 * 60 * 12,
    urgency: "normal",
  });
}

export function isExpiredPushSubscription(error: unknown): boolean {
  return (
    error instanceof WebPushError &&
    (error.statusCode === 404 || error.statusCode === 410)
  );
}
