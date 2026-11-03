import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { lane } from '../src/lane.js';
import type { DigestRow } from '../src/digest/types.js';

// Temp runs dir only: runs/ is read-only for tests.
let runsDir = '';

const good = [
  '{"at":"2026-10-28T01:00:00+01:00","job":"sync-customers","status":"ok","owner":"ops","error":null}',
  '{"at":"2026-10-28T01:05:00+01:00","job":"load-invoices","status":"retry","owner":"fin","error":"timeout"}',
  '{"at":"2026-10-28T01:06:00+01:00","job":"load-invoices","status":"retry","owner":"fin","error":"timeout"}',
  '{"at":"2026-10-28T01:07:00+01:00","job":"load-invoices","status":"retry","owner":"fin","error":"timeout"}',
  '{"at":"2026-10-28T01:08:00+01:00","job":"load-invoices","status":"ok","owner":"fin","error":null}',
  '{"at":"2026-10-28T02:00:00+01:00","job":"export-gl","status":"fail","owner":null,"error":"disk full"}',
];

const config = () => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

type JsonBody = { night: string; badLines: number; rows: DigestRow[] };

// Job names in the order they appear in the page HTML.
function jobOrderInPage(html: string, jobs: string[]): string[] {
  return jobs
    .map((job) => ({ job, at: html.indexOf(`<td>${job}</td>`) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.job);
}

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  writeFileSync(join(runsDir, '2026-10-28.jsonl'), good.join('\n') + '\n');
  writeFileSync(join(runsDir, '2026-10-26.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-10-27.jsonl'),
    [
      good[0],
      '{"at":"2026-10-27T01:0',
      good[5],
      '',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('digest page and JSON for a good night', () => {
  const jobs = ['export-gl', 'load-invoices', 'sync-customers'];

  it('page is 200, shows the lane banner and every job, in job order', async () => {
    const res = await createApp(config()).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain(lane().id);
    expect(html).toContain('digest · 2026-10-28');
    for (const job of jobs) expect(html).toContain(job);
    expect(jobOrderInPage(html, jobs)).toEqual(jobs);
    expect(html).toContain('retries ≥3');
  });

  it('JSON is 200 and its rows match the page job order', async () => {
    const pageHtml = await (await createApp(config()).request('/digest/2026-10-28')).text();
    const res = await createApp(config()).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(0);
    const jsonJobs = body.rows.map((r) => r.job);
    expect(jsonJobs).toEqual(jobs);
    expect(jobOrderInPage(pageHtml, jsonJobs)).toEqual(jsonJobs);
    const loadInvoices = body.rows.find((r) => r.job === 'load-invoices');
    expect(loadInvoices?.retries).toBe(3);
    expect(loadInvoices?.lastStatus).toBe('ok');
  });
});

describe('night with no file', () => {
  it('page is 404', async () => {
    const res = await createApp(config()).request('/digest/2026-11-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for that night');
  });

  it('JSON is 404', async () => {
    const res = await createApp(config()).request('/api/digest/2026-11-01');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string; night: string };
    expect(body.night).toBe('2026-11-01');
  });
});

describe('empty night (0-byte file)', () => {
  it('page is 200 and says nothing ran', async () => {
    const res = await createApp(config()).request('/digest/2026-10-26');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('JSON has no rows and no bad lines', async () => {
    const res = await createApp(config()).request('/api/digest/2026-10-26');
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });
});

describe('night with one bad line', () => {
  const jobs = ['export-gl', 'sync-customers'];

  it('page is 200, mentions the bad line, and still lists the good rows', async () => {
    const res = await createApp(config()).request('/digest/2026-10-27');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line in the log did not parse');
    for (const job of jobs) expect(html).toContain(job);
  });

  it('JSON is 200 with badLines 1 and the good rows still there', async () => {
    const res = await createApp(config()).request('/api/digest/2026-10-27');
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(jobs);
  });
});
