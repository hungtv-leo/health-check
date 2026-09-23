export type TimingVerdict = 'PASS' | 'WARNING' | 'FAIL';

export function classifyTiming(elapsedMs: number, passMaxMs: number, warningMaxMs: number): TimingVerdict {
  if (elapsedMs <= passMaxMs) return 'PASS';
  if (elapsedMs <= warningMaxMs) return 'WARNING';
  return 'FAIL';
}

export function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}
