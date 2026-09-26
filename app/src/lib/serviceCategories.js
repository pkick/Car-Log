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

// The catalog itself lives in `shared/` so the server can match services to intervals (PLAN.md D16).
export { CATEGORY_BY_ID, CATEGORY_ID_BY_SERVICE, SERVICE_CATEGORIES, SUBCATEGORIES } from '../../../shared/serviceCategories.js'

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

// Light tint behind a category's icon.
export const CATEGORY_TILE_CLASS = {
  amber: 'bg-amber/12',
  red: 'bg-red/12',
  teal: 'bg-teal/12',
  accent: 'bg-accent/12',
  slate: 'bg-slate/10',
}
