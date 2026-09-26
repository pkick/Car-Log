// The service catalog, shared by the app and the server (PLAN.md D16). The app adds icons and color classes in
// `app/src/lib/serviceCategories.js`, which re-exports this.

/** @type {ReadonlyArray<{ id: string, label: string, color: 'amber' | 'red' | 'teal' | 'accent' | 'slate' }>} */
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

/** The services under each category, keyed by category id. */
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
  Object.entries(SUBCATEGORIES)
    .flatMap(([categoryId, services]) => services.map((s) => [s, categoryId]))
    .reverse()
)
