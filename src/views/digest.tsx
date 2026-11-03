import type { DigestNight, DigestRow } from '../digest/types.js';

// Why a row is marked, in words (greyscale screenshots, slow readers). null = no mark.
export function rowWarning(row: DigestRow): string | null {
  const reasons: string[] = [];
  if (row.lastStatus === 'fail') reasons.push('fail');
  if (row.retries >= 3) reasons.push('retries ≥3');
  return reasons.length > 0 ? reasons.join(', ') : null;
}

// Rows as the page shows them, so a JSON route can reuse the same list.
export function digestRows(night: DigestNight): DigestRow[] {
  return night.rows;
}

const dash = '—';

export function DigestPage({ digest }: { digest: DigestNight }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      {digest.badLines > 0 && (
        <p class="warn">
          {digest.badLines} {digest.badLines === 1 ? 'line' : 'lines'} in the log did not parse
        </p>
      )}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {digestRows(digest).map((r) => {
              const why = rowWarning(r);
              return (
                <tr class={why ? 'warn' : undefined}>
                  <td>{r.job}</td>
                  <td>{r.owner ?? dash}</td>
                  <td>{r.runs}</td>
                  <td>{r.retries}{r.retries >= 3 ? ' (retries ≥3)' : ''}</td>
                  <td>{r.lastStatus === 'fail' ? '✗ fail' : r.lastStatus}</td>
                  <td>{r.lastError ?? dash}</td>
                  <td>{r.firstAt}</td>
                  <td>{r.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

export function DigestMissing({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="mute">no run log for that night</p>
    </>
  );
}
