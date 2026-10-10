import { useEffect, useState } from 'react';

// Counts per status for a list page's stat cards, taken from the same
// paginated `list` endpoint the page already calls (each request asks for
// `pageSize: 1` and reads `meta.total`). `statuses` is the list of status
// values to count in addition to the unfiltered total; results land in a
// `{ total, [status]: count }` object.
//
// These are extra requests on top of the page's own data, so they are kept
// gentle: only two run at a time (never crowding out the page's own list),
// and the last result is remembered for a minute, so coming back to a page
// shows the cards instantly while they quietly refresh.
const cache = new WeakMap(); // listFn -> { key, counts, at }
const MAX_PARALLEL = 2;

async function inBatches(tasks) {
  const results = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, tasks.length) }, worker));
  return results;
}

export function useStatusCounts(listFn, statuses, deps = []) {
  const key = JSON.stringify(deps);
  const [counts, setCounts] = useState(() => {
    const hit = cache.get(listFn);
    return hit && hit.key === key && Date.now() - hit.at < 60_000 ? hit.counts : null;
  });

  useEffect(() => {
    let cancelled = false;
    const hit = cache.get(listFn);
    if (hit && hit.key === key && Date.now() - hit.at < 20_000) { setCounts(hit.counts); return undefined; }

    // A short pause lets the page's own list request go first.
    const timer = setTimeout(() => {
      inBatches([
        () => listFn({ pageSize: 1 }),
        ...statuses.map((status) => () => listFn({ pageSize: 1, status })),
      ])
        .then((results) => {
          if (cancelled) return;
          const next = { total: results[0].meta.total };
          statuses.forEach((status, i) => { next[status] = results[i + 1].meta.total; });
          cache.set(listFn, { key, counts: next, at: Date.now() });
          setCounts(next);
        })
        .catch(() => { /* the cards just stay as they are; the page itself still works */ });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return counts;
}
