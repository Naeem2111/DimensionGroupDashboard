/** Build ISO datetime from separate date, time (HH:MM), and AM/PM. */
export function composeDueAtIso(
  date: string,
  time: string,
  ampm: "AM" | "PM"
): string | null {
  if (!date?.trim()) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
  if (ampm === "AM") {
    if (hours === 12) hours = 0;
  } else if (hours !== 12) {
    hours += 12;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date}T${pad(hours)}:${pad(minutes)}:00`;
}

export function splitDueAtIso(iso: string | null | undefined): {
  date: string;
  time: string;
  ampm: "AM" | "PM";
} {
  if (!iso) return { date: "", time: "", ampm: "AM" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "", ampm: "AM" };
  const date = d.toISOString().slice(0, 10);
  let h = d.getHours();
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  const time = `${h}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time, ampm };
}
