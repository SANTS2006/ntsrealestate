// Generates a Tailwind-style 50–950 tonal scale from a single hex color,
// so a platform admin picking just two colors (primary/secondary) for a
// tenant is enough to theme the whole app. The input color anchors the
// "600" stop (this app's existing convention — see tailwind.config.js's
// comment on `brand-600` being "the default used for buttons/links/
// active-states"); lighter stops are mixed toward white, darker stops
// toward black, by the given percentage — the same technique most
// Tailwind shade-generator tools use.
const LIGHT_MIX = { 50: 0.95, 100: 0.9, 200: 0.75, 300: 0.6, 400: 0.35, 500: 0.15 };
const DARK_MIX = { 700: 0.15, 800: 0.3, 900: 0.45, 950: 0.6 };

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized;
  const int = parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function mix([r, g, b], [tr, tg, tb], amount) {
  return [
    Math.round(r + (tr - r) * amount),
    Math.round(g + (tg - g) * amount),
    Math.round(b + (tb - b) * amount),
  ];
}

// Returns { 50: 'R G B', 100: 'R G B', ..., 950: 'R G B' } — space-separated
// RGB channels, the format Tailwind's `rgb(var(--x) / <alpha-value>)`
// pattern expects (see tailwind.config.js).
export function generateColorRamp(hex) {
  const base = hexToRgb(hex);
  const white = [255, 255, 255];
  const black = [0, 0, 0];
  const ramp = { 600: base };

  for (const [stop, amount] of Object.entries(LIGHT_MIX)) ramp[stop] = mix(base, white, amount);
  for (const [stop, amount] of Object.entries(DARK_MIX)) ramp[stop] = mix(base, black, amount);

  return Object.fromEntries(Object.entries(ramp).map(([stop, rgb]) => [stop, rgb.join(' ')]));
}

// Applies a ramp as `--color-{prefix}-{stop}` custom properties on the
// given element (defaults to the document root), matching what
// tailwind.config.js's brand/accent colors reference.
export function applyColorRamp(prefix, hex, target = document.documentElement) {
  const ramp = generateColorRamp(hex);
  for (const [stop, rgb] of Object.entries(ramp)) {
    target.style.setProperty(`--color-${prefix}-${stop}`, rgb);
  }
}
