/**
 * Google Calendar integration for Jethro's availability (Book a Call).
 *
 * Required env (see .env.example):
 * - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 * - GOOGLE_CALENDAR_ID (optional, default "primary")
 */

export type GoogleCalendarConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
  timezone: string;
  slotMinutes: number;
  workdayStartHour: number;
  workdayEndHour: number;
  horizonDays: number;
};

export type AvailableSlot = {
  start: string;
  end: string;
  label: string;
};

export function getGoogleCalendarConfig(): GoogleCalendarConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;

  return {
    clientId,
    clientSecret,
    refreshToken,
    calendarId: process.env.GOOGLE_CALENDAR_ID?.trim() || "primary",
    timezone: process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() || "Europe/London",
    slotMinutes: Math.min(120, Math.max(15, parseInt(process.env.GOOGLE_SLOT_MINUTES || "30", 10) || 30)),
    workdayStartHour: parseInt(process.env.GOOGLE_WORKDAY_START || "9", 10) || 9,
    workdayEndHour: parseInt(process.env.GOOGLE_WORKDAY_END || "17", 10) || 17,
    horizonDays: Math.min(42, Math.max(7, parseInt(process.env.GOOGLE_AVAILABILITY_DAYS || "21", 10) || 21)),
  };
}

export function isGoogleCalendarConfigured(): boolean {
  return getGoogleCalendarConfig() !== null;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: GoogleCalendarConfig): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || "Failed to refresh Google access token");
  }

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

async function googleFetch(
  config: GoogleCalendarConfig,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getAccessToken(config);
  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** Busy intervals from Google freeBusy API. */
export async function fetchBusyIntervals(
  config: GoogleCalendarConfig,
  timeMin: Date,
  timeMax: Date
): Promise<Array<{ start: Date; end: Date }>> {
  const res = await googleFetch(config, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: config.timezone,
      items: [{ id: config.calendarId }],
    }),
  });

  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message || "Google freeBusy request failed");
  }

  const busy = data.calendars?.[config.calendarId]?.busy ?? [];
  return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    weekday: parts.find((p) => p.type === "weekday")?.value ?? "",
  };
}

function isWeekend(weekday: string): boolean {
  const w = weekday.toLowerCase().replace(/\./g, "");
  return w.startsWith("sat") || w.startsWith("sun");
}

export function getDefaultSlotConfig(): GoogleCalendarConfig {
  return {
    clientId: "",
    clientSecret: "",
    refreshToken: "",
    calendarId: "primary",
    timezone: process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() || "Europe/London",
    slotMinutes: Math.min(120, Math.max(15, parseInt(process.env.GOOGLE_SLOT_MINUTES || "30", 10) || 30)),
    workdayStartHour: parseInt(process.env.GOOGLE_WORKDAY_START || "9", 10) || 9,
    workdayEndHour: parseInt(process.env.GOOGLE_WORKDAY_END || "17", 10) || 17,
    horizonDays: Math.min(42, Math.max(7, parseInt(process.env.GOOGLE_AVAILABILITY_DAYS || "21", 10) || 21)),
  };
}

/** UTC instant for a local wall-clock time in `timeZone`. */
export function dateAtLocalTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    hour12: false,
  });

  const wallUtc = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wallUtc;

  for (let i = 0; i < 8; i++) {
    const parts = formatter.formatToParts(new Date(guess));
    const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    const py = pick("year");
    const pm = pick("month");
    const pd = pick("day");
    const ph = pick("hour");
    const pmin = pick("minute");

    const shownUtc = Date.UTC(py, pm - 1, pd, ph, pmin);
    const diff = shownUtc - wallUtc;
    if (diff === 0) return new Date(guess);
    guess -= diff;
  }

  return new Date(guess);
}

/** Weekday time slots in the configured timezone (used with or without Google Calendar). */
export function generateCandidateSlots(config: GoogleCalendarConfig): AvailableSlot[] {
  const slots: AvailableSlot[] = [];
  const now = Date.now();
  const leadMs = 2 * 60 * 60 * 1000;
  const slotMs = config.slotMinutes * 60 * 1000;
  const seenDays = new Set<string>();
  const maxMs = config.horizonDays * 24 * 60 * 60 * 1000;

  for (let offset = 0; offset <= maxMs && seenDays.size < config.horizonDays + 7; offset += 3 * 60 * 60 * 1000) {
    const probe = new Date(now + offset);
    const zp = getZonedParts(probe, config.timezone);
    const dayKey = `${zp.year}-${zp.month}-${zp.day}`;
    if (seenDays.has(dayKey) || isWeekend(zp.weekday)) continue;
    seenDays.add(dayKey);

    for (let hour = config.workdayStartHour; hour < config.workdayEndHour; hour++) {
      for (let min = 0; min < 60; min += config.slotMinutes) {
        if (hour === config.workdayEndHour - 1 && min + config.slotMinutes > 60) continue;

        const start = dateAtLocalTime(zp.year, zp.month, zp.day, hour, min, config.timezone);
        if (start.getTime() < now + leadMs) continue;

        const end = new Date(start.getTime() + slotMs);
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          label: formatSlotLabel(start, end, config.timezone),
        });
      }
    }
  }

  slots.sort((a, b) => a.start.localeCompare(b.start));
  return slots;
}

export function formatSlotLabel(start: Date, end: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${fmt.format(start)} – ${endFmt.format(end)}`;
}

export async function listAvailableSlots(
  extraBusy: Array<{ start: Date; end: Date }> = []
): Promise<{ slots: AvailableSlot[]; source: "google_calendar" | "manual" }> {
  const config = getGoogleCalendarConfig();
  const slotConfig = config ?? getDefaultSlotConfig();
  const candidates = generateCandidateSlots(slotConfig);

  if (candidates.length === 0) {
    console.error("generateCandidateSlots returned no slots");
  }

  if (!config) {
    return { slots: candidates.slice(0, 60), source: "manual" };
  }

  try {
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + config.horizonDays);
    const busy = [...(await fetchBusyIntervals(config, timeMin, timeMax)), ...extraBusy];

    const free = candidates.filter((slot) => {
      const s = new Date(slot.start);
      const e = new Date(slot.end);
      return !busy.some((b) => overlaps(s, e, b.start, b.end));
    });

    const picked = free.length > 0 ? free : candidates;
    return { slots: picked.slice(0, 60), source: "google_calendar" };
  } catch (e) {
    console.error("Google Calendar availability failed:", e);
    return { slots: candidates.slice(0, 60), source: "manual" };
  }
}

export type CreateEventInput = {
  title: string;
  description: string;
  start: Date;
  end: Date;
  attendeeEmail?: string | null;
};

export async function createGoogleCalendarEvent(
  input: CreateEventInput
): Promise<{ eventId: string; htmlLink: string | null } | null> {
  const config = getGoogleCalendarConfig();
  if (!config) return null;

  const body: Record<string, unknown> = {
    summary: input.title,
    description: input.description,
    start: { dateTime: input.start.toISOString(), timeZone: config.timezone },
    end: { dateTime: input.end.toISOString(), timeZone: config.timezone },
  };

  if (input.attendeeEmail) {
    body.attendees = [{ email: input.attendeeEmail }];
  }

  const res = await googleFetch(
    config,
    `/calendars/${encodeURIComponent(config.calendarId)}/events?sendUpdates=all`,
    { method: "POST", body: JSON.stringify(body) }
  );

  const data = (await res.json()) as { id?: string; htmlLink?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || "Failed to create calendar event");
  }

  return { eventId: data.id, htmlLink: data.htmlLink ?? null };
}

export async function patchGoogleCalendarEvent(
  eventId: string,
  patch: { description?: string; start?: Date; end?: Date }
): Promise<void> {
  const config = getGoogleCalendarConfig();
  if (!config) return;

  const body: Record<string, unknown> = {};
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.start) body.start = { dateTime: patch.start.toISOString(), timeZone: config.timezone };
  if (patch.end) body.end = { dateTime: patch.end.toISOString(), timeZone: config.timezone };

  const res = await googleFetch(
    config,
    `/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "PATCH", body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const data = (await res.json()) as { error?: { message?: string } };
    throw new Error(data.error?.message || "Failed to update calendar event");
  }
}
