function csvEscape(value) {
  const str = value == null ? '' : String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

const HEADERS = [
  'Type', 'Vehicle', 'Date', 'Odometer', 'Gallons', 'Price/Gal', 'Total',
  'Category', 'Description', 'Cost', 'Performed By', 'Shop', 'Parts Used', 'Notes',
]

export function buildCsv(vehicles, fillUps, serviceRecords) {
  const vehicleName = (id) => vehicles.find((v) => v.id === id)?.nickname || `Vehicle ${id}`

  const rows = [
    ...fillUps.map((f) => [
      'Fuel', vehicleName(f.vehicleId), f.date, f.odometer, f.gallons, f.pricePerGal, f.total,
      '', f.isFull ? 'Fill-up' : 'Partial fill-up', '', '', '', '', '',
    ]),
    ...serviceRecords.map((r) => [
      'Service', vehicleName(r.vehicleId), r.date, r.odometer, '', '', '',
      r.categoryId, r.services.join('; '), r.cost, r.performedBy, r.shopName, r.partsUsed, r.notes,
    ]),
  ].sort((a, b) => String(a[2]).localeCompare(String(b[2])))

  return [HEADERS, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
}

export function downloadCsv(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
