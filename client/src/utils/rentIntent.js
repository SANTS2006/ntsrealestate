// "I want to rent this" survives the detour through sign-in / registration /
// email verification, which can span several page loads: the company website
// sends a visitor to /:orgSlug/rent?unit=…, and if they have to sign in or
// create an account first, this remembers what they asked for so the very
// next thing that happens after they are signed in is the rental itself.
// Stored per-browser only; never sent anywhere until the rental is submitted.
const KEY = 'nts.rentIntent';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function saveRentIntent({ orgSlug, unitId, buildingId, landId, kind }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ orgSlug, unitId: unitId ?? null, buildingId: buildingId ?? null, landId: landId ?? null, kind: kind ?? 'rent', savedAt: Date.now() }));
  } catch {
    // Storage blocked — the user can simply follow the rental link again.
  }
}

export function getRentIntent(orgSlug) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw);
    if (intent.orgSlug !== orgSlug || Date.now() - intent.savedAt > MAX_AGE_MS) return null;
    return intent;
  } catch {
    return null;
  }
}

export function clearRentIntent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function rentPath(intent) {
  const params = new URLSearchParams();
  if (intent.unitId) params.set('unit', intent.unitId);
  else if (intent.buildingId) params.set('building', intent.buildingId);
  else if (intent.landId) params.set('land', intent.landId);
  if (intent.kind && intent.kind !== 'rent') params.set('kind', intent.kind);
  return `/${intent.orgSlug}/rent?${params.toString()}`;
}
