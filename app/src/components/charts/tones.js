// Tone → class maps for chart marks. Written out in full so Tailwind finds every class, and all
// built from the color tokens so dark mode (P2-G) stays a token swap. `neutral` is ink at 40%: a
// light gray series (registration spend) that stays apart from slate and isn't a status color.

/** @typedef {'accent' | 'teal' | 'amber' | 'green' | 'red' | 'ink' | 'slate' | 'neutral'} ChartTone */

export const STROKE = {
  accent: 'stroke-accent',
  teal: 'stroke-teal',
  amber: 'stroke-amber',
  green: 'stroke-green',
  red: 'stroke-red',
  ink: 'stroke-ink',
  slate: 'stroke-slate',
  neutral: 'stroke-ink/40',
}

export const FILL = {
  accent: 'fill-accent',
  teal: 'fill-teal',
  amber: 'fill-amber',
  green: 'fill-green',
  red: 'fill-red',
  ink: 'fill-ink',
  slate: 'fill-slate',
  neutral: 'fill-ink/40',
}

/** The area under a line: the series hue as a 10% wash. */
export const WASH = {
  accent: 'fill-accent/10',
  teal: 'fill-teal/10',
  amber: 'fill-amber/10',
  green: 'fill-green/10',
  red: 'fill-red/10',
  ink: 'fill-ink/10',
  slate: 'fill-slate/10',
  neutral: 'fill-ink/4',
}

/** Legend swatches and tooltip line keys. */
export const BG = {
  accent: 'bg-accent',
  teal: 'bg-teal',
  amber: 'bg-amber',
  green: 'bg-green',
  red: 'bg-red',
  ink: 'bg-ink',
  slate: 'bg-slate',
  neutral: 'bg-ink/40',
}

export const BORDER = {
  accent: 'border-accent',
  teal: 'border-teal',
  amber: 'border-amber',
  green: 'border-green',
  red: 'border-red',
  ink: 'border-ink',
  slate: 'border-slate',
  neutral: 'border-ink/40',
}

/** Axis and label text size in px. Fixed, so gutters can be computed from character counts. */
export const AXIS_FONT = 11

/** IBM Plex Mono advances 0.6em per character. */
export const CHAR_WIDTH = AXIS_FONT * 0.6

/**
 * Pixel width of a mono label at the axis size.
 * @param {string} text
 * @returns {number}
 */
export const textWidth = (text) => text.length * CHAR_WIDTH

/**
 * Default value formatter: up to two decimals, thousands separators.
 * @param {number} value
 * @returns {string}
 */
export const formatNumber = (value) => value.toLocaleString('en-US', { maximumFractionDigits: 2 })
