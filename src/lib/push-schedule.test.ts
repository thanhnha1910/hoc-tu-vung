import assert from "node:assert/strict";
import test from "node:test";
import { getLocalScheduleParts, isSubscriptionDue } from "./push-schedule.ts";

test("converts UTC time to the device timezone", () => {
  assert.deepEqual(
    getLocalScheduleParts(new Date("2026-08-30T13:15:00.000Z"), "Asia/Ho_Chi_Minh"),
    { date: "2026-08-30", hour: 20 },
  );
});

test("sends once at the preferred local hour", () => {
  const now = new Date("2026-08-30T13:15:00.000Z");
  const base = {
    timezone: "Asia/Ho_Chi_Minh",
    preferred_hour: 20,
  };

  assert.equal(isSubscriptionDue({ ...base, last_notified_on: null }, now).due, true);
  assert.equal(
    isSubscriptionDue({ ...base, last_notified_on: "2026-08-30" }, now).due,
    false,
  );
});

test("falls back to UTC for an invalid timezone", () => {
  const result = isSubscriptionDue(
    { timezone: "Not/AZone", preferred_hour: 13, last_notified_on: null },
    new Date("2026-08-30T13:15:00.000Z"),
  );
  assert.deepEqual(result, { due: true, localDate: "2026-08-30" });
});
