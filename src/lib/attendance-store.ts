// Casual worker attendance — local-only tracking (no backend model yet).
// Stored per worker as a map of ISO date -> { fraction, pay?, note? }.
// `fraction` is the portion of the day worked (1 = full, 0.5 = half, etc.).
// `pay` is an optional override that replaces fraction * dailyRate for that day.

const KEY = "peaceful-acres-casual-attendance-v1";

export type AttendanceEntry = {
  fraction: number;   // e.g. 1, 0.5, 0.25
  pay?: number;       // optional override for this day's pay
  note?: string;
};

export type WorkerAttendance = Record<string, AttendanceEntry>; // iso -> entry
type RawMap = Record<string, WorkerAttendance | string[]>;      // legacy compat

function read(): RawMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RawMap) : {};
  } catch {
    return {};
  }
}

function write(map: RawMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(map));
  window.dispatchEvent(new Event("peaceful-acres-attendance-changed"));
}

function normalize(v: WorkerAttendance | string[] | undefined): WorkerAttendance {
  if (!v) return {};
  if (Array.isArray(v)) {
    // Legacy: array of ISO dates -> full-day entries.
    const out: WorkerAttendance = {};
    for (const iso of v) out[iso] = { fraction: 1 };
    return out;
  }
  return v;
}

export function getWorkerAttendanceMap(workerId: string): WorkerAttendance {
  return normalize(read()[workerId]);
}

// Backwards-compat: list of ISO strings for days with any attendance.
export function getWorkerAttendance(workerId: string): string[] {
  return Object.keys(getWorkerAttendanceMap(workerId)).sort();
}

export function setWorkerAttendance(workerId: string, dates: string[]) {
  // Preserve existing per-day details; add full-day entries for new dates.
  const map = read();
  const current = normalize(map[workerId]);
  const next: WorkerAttendance = {};
  for (const iso of dates) {
    next[iso] = current[iso] ?? { fraction: 1 };
  }
  map[workerId] = next;
  write(map);
}

export function setDayEntry(workerId: string, iso: string, entry: AttendanceEntry) {
  const map = read();
  const current = normalize(map[workerId]);
  current[iso] = entry;
  map[workerId] = current;
  write(map);
}

export function removeDay(workerId: string, iso: string) {
  const map = read();
  const current = normalize(map[workerId]);
  delete current[iso];
  map[workerId] = current;
  write(map);
}

export function computeWage(entries: WorkerAttendance, dailyRate: number): number {
  return Object.values(entries).reduce(
    (sum, e) => sum + (e.pay != null ? e.pay : e.fraction * dailyRate),
    0,
  );
}

export const ATTENDANCE_CHANGE_EVENT = "peaceful-acres-attendance-changed";
