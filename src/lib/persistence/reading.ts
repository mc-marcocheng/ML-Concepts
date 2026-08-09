export interface ReadingRecord {
  conceptId: string;
  ts: number;
}

const READINGS_KEY = 'mlc.readings';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event('storage'));
}

export function loadReadings(): ReadingRecord[] {
  return readJson<ReadingRecord[]>(READINGS_KEY, []);
}

export function recordReading(conceptId: string) {
  const readings = loadReadings().filter(record => record.conceptId !== conceptId);
  readings.unshift({ conceptId, ts: Date.now() });
  writeJson(READINGS_KEY, readings.slice(0, 100));
}
