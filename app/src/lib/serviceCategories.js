import {
  OilDropIcon,
  BrakesIcon,
  TiresIcon,
  FiltersIcon,
  FluidsIcon,
  WiperIcon,
  ElectricalIcon,
  GearShiftIcon,
  ShockAbsorberIcon,
  WrenchIcon,
} from '../components/icons'

export const SERVICE_CATEGORIES = [
  { id: 'oil', label: 'Oil', color: 'amber' },
  { id: 'brakes', label: 'Brakes', color: 'red' },
  { id: 'tires', label: 'Tires', color: 'teal' },
  { id: 'filters', label: 'Filters', color: 'teal' },
  { id: 'fluids', label: 'Fluids', color: 'accent' },
  { id: 'wipers', label: 'Wipers', color: 'accent' },
  { id: 'electrical', label: 'Electrical', color: 'slate' },
  { id: 'drivetrain', label: 'Drivetrain', color: 'slate' },
  { id: 'suspension', label: 'Suspension', color: 'slate' },
  { id: 'other', label: 'Other', color: 'slate' },
]

export const CATEGORY_BY_ID = Object.fromEntries(SERVICE_CATEGORIES.map((c) => [c.id, c]))

export const SUBCATEGORIES = {
  oil: ['Oil + filter change', 'Oil only (top-off)', 'Oil filter only'],
  brakes: ['Brake pads', 'Brake fluid', 'Brake rotors', 'Brake lines'],
  tires: ['Tire rotation', 'Tire replacement', 'Tire balance', 'Tire repair'],
  filters: ['Air filter', 'Cabin air filter', 'Fuel filter', 'Transmission filter'],
  fluids: ['Coolant flush', 'Transmission fluid', 'Brake fluid', 'Power steering fluid'],
  wipers: ['Front wiper blades', 'Rear wiper blade', 'Washer fluid'],
  electrical: ['Battery', 'Alternator', 'Starter', 'Spark plugs'],
  drivetrain: ['Transmission service', 'Differential service', 'Clutch'],
  suspension: ['Struts', 'Springs', 'Shocks', 'Control arms'],
  other: ['Other service'],
}

// Reverse lookup: subcategory service name -> the categoryId it belongs to (first match wins
// for names that appear under more than one category, e.g. "Brake fluid").
export const CATEGORY_ID_BY_SERVICE = Object.fromEntries(
  Object.entries(SUBCATEGORIES).flatMap(([categoryId, services]) => services.map((s) => [s, categoryId]))
)

export const CATEGORY_ICON = {
  oil: OilDropIcon,
  brakes: BrakesIcon,
  tires: TiresIcon,
  filters: FiltersIcon,
  fluids: FluidsIcon,
  wipers: WiperIcon,
  electrical: ElectricalIcon,
  drivetrain: GearShiftIcon,
  suspension: ShockAbsorberIcon,
  other: WrenchIcon,
}

export const CATEGORY_BG_CLASS = {
  amber: 'bg-amber',
  red: 'bg-red',
  teal: 'bg-teal',
  accent: 'bg-accent',
  slate: 'bg-slate',
}

export const CATEGORY_TEXT_CLASS = {
  amber: 'text-amber',
  red: 'text-red',
  teal: 'text-teal',
  accent: 'text-accent',
  slate: 'text-slate',
}

// Tailwind can't derive an alpha channel from these colors' oklch() values (slate is a plain
// hex and is fine with the normal /NN opacity syntax), so the tint bakes the alpha into the
// oklch() string itself via an arbitrary-value class.
export const CATEGORY_TILE_CLASS = {
  amber: 'bg-[oklch(0.66_0.14_68/12%)]',
  red: 'bg-[oklch(0.55_0.17_28/12%)]',
  teal: 'bg-[oklch(0.56_0.13_195/12%)]',
  accent: 'bg-[oklch(0.56_0.19_258/12%)]',
  slate: 'bg-slate/10',
}
