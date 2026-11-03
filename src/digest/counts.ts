import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type NightCounts = { ok: number; retry: number; fail: number; badLines: number };

// Log lines per status for one night. Unreadable file or bad lines: counted in badLines, never thrown.
export function nightCounts(runsDir: string, night: string): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0, badLines: 0 };
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return counts;
  }
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    let status: unknown;
    try {
      const v: unknown = JSON.parse(raw);
      status = typeof v === 'object' && v !== null ? (v as Record<string, unknown>).status : undefined;
    } catch {
      status = undefined;
    }
    if (status === 'ok' || status === 'retry' || status === 'fail') counts[status]++;
    else counts.badLines++;
  }
  return counts;
}
