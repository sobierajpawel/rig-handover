// Contract for the morning digest (plan.md § 1). Every part of § 2 builds on these types.

export type DigestStatus = 'ok' | 'retry' | 'fail';

// One row per job for a night.
export type DigestRow = {
  job: string;
  owner: string | null; // null in the log: keep the row, render as —
  runs: number; // lines for this job
  retries: number; // lines with status 'retry'
  lastStatus: DigestStatus;
  lastError: string | null;
  firstAt: string; // `at` exactly as in the log, offset included; never converted
  lastAt: string; // same
};

// A night read from runs/<night>.jsonl.
// - rows sorted by job.
// - badLines: lines that didn't parse; counted, never thrown.
// - an empty file is { rows: [], badLines: 0 }.
export type DigestNight = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[];
  badLines: number;
};

// null = no file for this night (the page returns 404).
export type ReadNight = (runsDir: string, night: string) => DigestNight | null;
