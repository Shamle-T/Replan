export function atLocalTime(base: Date, hours: number, minutes = 0): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0);
}

export function timeInputValue(date?: Date): string {
  if (!date) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function dateFromTimeInput(base: Date, value: string): Date | undefined {
  if (!value) return undefined;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
  return atLocalTime(base, hours, minutes);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatDurationCompact(minutes: number): string {
  const rounded = Math.max(0, Math.round(Math.abs(minutes)));
  if (rounded < 60) return `${rounded}m`;
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}
