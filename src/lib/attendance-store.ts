// Casual worker attendance — local-only tracking (no backend model yet).
// Stored as { [workerId]: string[] } where each string is an ISO date "YYYY-MM-DD".

const KEY = "peaceful-acres-casual-attendance-v1";

type AttendanceMap = Record<string, string[]>;

function read(): AttendanceMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AttendanceMap) : {};
  } catch {
    return {};
  }
}

function write(map: AttendanceMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(map));
  window.dispatchEvent(new Event("peaceful-acres-attendance-changed"));
}

export function getWorkerAttendance(workerId: string): string[] {
  return read()[workerId] ?? [];
}

export function setWorkerAttendance(workerId: string, dates: string[]) {
  const map = read();
  map[workerId] = Array.from(new Set(dates)).sort();
  write(map);
}

export function toggleAttendance(workerId: string, iso: string) {
  const current = getWorkerAttendance(workerId);
  const next = current.includes(iso)
    ? current.filter((d) => d !== iso)
    : [...current, iso];
  setWorkerAttendance(workerId, next);
  return next;
}

export const ATTENDANCE_CHANGE_EVENT = "peaceful-acres-attendance-changed";
