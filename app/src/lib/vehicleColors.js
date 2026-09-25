export const VEHICLE_COLORS = ['slate', 'accent', 'teal', 'green', 'amber', 'red']

export const VEHICLE_COLOR_TEXT_CLASS = {
  slate: 'text-slate',
  accent: 'text-accent',
  teal: 'text-teal',
  green: 'text-green',
  amber: 'text-amber',
  red: 'text-red',
}

export const VEHICLE_COLOR_SWATCH_CLASS = {
  slate: 'bg-slate',
  accent: 'bg-accent',
  teal: 'bg-teal',
  green: 'bg-green',
  amber: 'bg-amber',
  red: 'bg-red',
}

// Light tint for the card background behind the car icon. Tailwind can't derive an alpha channel
// from these colors' oklch() values (slate is a plain hex and is fine with the normal /NN syntax),
// so the tint bakes the alpha into the oklch() string itself via an arbitrary-value class.
export const VEHICLE_COLOR_TILE_CLASS = {
  slate: 'bg-slate/8',
  accent: 'bg-[oklch(0.56_0.19_258/10%)]',
  teal: 'bg-[oklch(0.56_0.13_195/10%)]',
  green: 'bg-[oklch(0.5_0.14_150/10%)]',
  amber: 'bg-[oklch(0.66_0.14_68/10%)]',
  red: 'bg-[oklch(0.55_0.17_28/10%)]',
}
