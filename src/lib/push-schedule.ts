export interface LocalScheduleParts {
  date: string;
  hour: number;
}

export function getLocalScheduleParts(
  now: Date,
  timezone: string,
): LocalScheduleParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

export function isSubscriptionDue(
  subscription: {
    timezone: string;
    preferred_hour: number;
    last_notified_on: string | null;
  },
  now: Date,
): { due: boolean; localDate: string } {
  let local: LocalScheduleParts;
  try {
    local = getLocalScheduleParts(now, subscription.timezone);
  } catch {
    local = getLocalScheduleParts(now, "UTC");
  }

  return {
    due:
      local.hour === subscription.preferred_hour &&
      subscription.last_notified_on !== local.date,
    localDate: local.date,
  };
}
