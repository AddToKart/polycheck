/**
 * PUP palette constants — single source for raw color values that cannot use
 * Tailwind class tokens (maplibre paint properties, SVG attributes, charts).
 * Keep in sync with the CSS tokens in `src/app/globals.css` `@theme`.
 */
export const pupColors = {
  maroon: '#7B1113',
  maroonDark: '#4A0A0B',
  golden: '#FFDF00',
  goldenDark: '#E09A00',
  surfaceDark: '#121215',
  black: '#0A0A0A',
  white: '#FFFFFF',
  // Attendance marker colors (maplibre paint, not CSS). `excused` uses
  // goldenDark in the map layer below.
  present: '#22C55E',
  absent: '#EF4444',
  pending: '#9CA3AF',
  disputed: '#F59E0B',
  // Chart-only neutrals that need a raw value in SVG/legend props.
  chartPending: '#A1A1AA',
  chartDisputed: '#D97706',
} as const
