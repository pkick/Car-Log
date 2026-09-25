function dateMonthKey(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${d.getMonth()}`
}

// Accumulates gallons across partial fills until the next full fill, so MPG
// is only ever computed for a tank-to-tank span that actually started and
// ended full. Expects fills for ONE vehicle sorted ascending by odometer.
export function computeFillMpg(fillsAsc) {
  let lastFullOdometer = null
  let accumulatedGallons = 0

  return fillsAsc.map((fill) => {
    accumulatedGallons += fill.gallons

    if (!fill.isFull) {
      return { ...fill, mpg: null }
    }

    let mpg = null
    if (lastFullOdometer != null && accumulatedGallons > 0) {
      const milesDriven = fill.odometer - lastFullOdometer
      mpg = Math.round((milesDriven / accumulatedGallons) * 10) / 10
    }

    lastFullOdometer = fill.odometer
    accumulatedGallons = 0
    return { ...fill, mpg }
  })
}

export function getFuelStats(fillsForVehicle) {
  const sorted = [...fillsForVehicle].sort((a, b) => a.odometer - b.odometer)
  const withMpg = computeFillMpg(sorted)
  const validMpgs = withMpg.filter((f) => f.mpg != null).map((f) => f.mpg)
  const avgMpg = validMpgs.length
    ? Math.round((validMpgs.reduce((a, b) => a + b, 0) / validMpgs.length) * 10) / 10
    : null

  const totalSpend = sorted.reduce((sum, f) => sum + f.total, 0)
  const totalMiles = sorted.length >= 2 ? sorted[sorted.length - 1].odometer - sorted[0].odometer : 0
  const costPerMile = totalMiles > 0 ? Math.round((totalSpend / totalMiles) * 100) / 100 : null

  const now = new Date()
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthKey = `${prevDate.getFullYear()}-${prevDate.getMonth()}`

  const spendThisMonth = sorted.filter((f) => dateMonthKey(f.date) === thisMonthKey).reduce((s, f) => s + f.total, 0)
  const spendLastMonth = sorted.filter((f) => dateMonthKey(f.date) === lastMonthKey).reduce((s, f) => s + f.total, 0)
  const spendDelta = spendLastMonth > 0 ? Math.round(((spendThisMonth - spendLastMonth) / spendLastMonth) * 1000) / 10 : null

  return { avgMpg, costPerMile, spendThisMonth: Math.round(spendThisMonth), spendDelta, withMpg }
}

export function getDueSoonItems(vehicle, serviceRecords, currentOdometer) {
  const intervals = vehicle.intervals || []
  const today = new Date()

  const items = intervals.map((interval) => {
    const matching = serviceRecords
      .filter((r) => r.categoryId === interval.categoryId)
      .sort((a, b) => b.odometer - a.odometer)
    const last = matching[0]

    const baseOdometer = last ? last.odometer : vehicle.purchaseOdometer ?? 0
    const baseDate = last ? last.date : vehicle.purchaseDate || today.toISOString().slice(0, 10)

    const milesSince = currentOdometer - baseOdometer
    const daysSince = Math.floor((today - new Date(baseDate)) / 86400000)

    const milesRemaining = interval.miles != null ? interval.miles - milesSince : null
    const daysRemaining = interval.months != null ? interval.months * 30 - daysSince : null

    let status = 'ok'
    if ((milesRemaining != null && milesRemaining <= 0) || (daysRemaining != null && daysRemaining <= 0)) {
      status = 'overdue'
    } else if (
      (milesRemaining != null && milesRemaining <= interval.warnMiles) ||
      (daysRemaining != null && daysRemaining <= interval.warnDays)
    ) {
      status = 'coming-up'
    }

    const remainingLabel =
      milesRemaining != null
        ? milesRemaining <= 0
          ? `Due ${Math.abs(milesRemaining).toLocaleString()} mi ago`
          : `${milesRemaining.toLocaleString()} mi`
        : daysRemaining <= 0
          ? 'OVERDUE'
          : `~${Math.round(daysRemaining / 7)} wks`

    const detailLabel = [
      interval.miles != null ? `every ${interval.miles.toLocaleString()} mi` : null,
      interval.months != null ? `${interval.miles != null ? 'or ' : 'every '}${interval.months} mo` : null,
    ]
      .filter(Boolean)
      .join(' ')

    return {
      intervalId: interval.id,
      categoryId: interval.categoryId,
      name: interval.name,
      status,
      remainingLabel,
      detailLabel,
      milesRemaining,
      lastServiceOdometer: last?.odometer ?? null,
      lastServiceDate: last?.date ?? null,
    }
  })

  const order = { overdue: 0, 'coming-up': 1, ok: 2 }
  return items.sort(
    (a, b) => order[a.status] - order[b.status] || (a.milesRemaining ?? Infinity) - (b.milesRemaining ?? Infinity)
  )
}

export function getServiceHistorySorted(records) {
  return [...records].sort((a, b) => new Date(b.date) - new Date(a.date))
}

export function getRecords(fillsForVehicle) {
  const sorted = [...fillsForVehicle].sort((a, b) => a.odometer - b.odometer)
  const withMpg = computeFillMpg(sorted)
  const validMpgs = withMpg.filter((f) => f.mpg != null).map((f) => f.mpg)

  return {
    bestMpg: validMpgs.length ? Math.max(...validMpgs) : null,
    worstMpg: validMpgs.length ? Math.min(...validMpgs) : null,
    cheapestGal: sorted.length ? Math.min(...sorted.map((f) => f.pricePerGal)) : null,
    totalMiles: sorted.length >= 2 ? sorted[sorted.length - 1].odometer - sorted[0].odometer : 0,
  }
}

export function getMonthlySpend(fillsForVehicle, recordsForVehicle) {
  const now = new Date()
  const months = []
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: d.toLocaleString('en-US', { month: 'short' }) })
  }

  return months.map(({ key, month }) => ({
    month,
    fuel: Math.round(fillsForVehicle.filter((f) => dateMonthKey(f.date) === key).reduce((s, f) => s + f.total, 0)),
    service: Math.round(recordsForVehicle.filter((r) => dateMonthKey(r.date) === key).reduce((s, r) => s + r.cost, 0)),
  }))
}

export function getPricePaidBuckets(fillsForVehicle) {
  const buckets = {}
  fillsForVehicle.forEach((f) => {
    const key = f.pricePerGal.toFixed(2)
    buckets[key] = (buckets[key] || 0) + 1
  })
  return Object.entries(buckets)
    .map(([price, count]) => ({ price: parseFloat(price), count }))
    .sort((a, b) => a.price - b.price)
}

export function getDrivingRate(fillsForVehicle) {
  const sorted = [...fillsForVehicle].sort((a, b) => new Date(a.date) - new Date(b.date))
  if (sorted.length < 2) return { milesPerMonth: 0, milesPerYear: 0, fillsPerYear: 0 }

  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const daysSpan = Math.max(1, (new Date(last.date) - new Date(first.date)) / 86400000)
  const milesSpan = last.odometer - first.odometer
  const milesPerMonth = Math.round(milesSpan / (daysSpan / 30))

  return {
    milesPerMonth,
    milesPerYear: Math.round(milesPerMonth * 12),
    fillsPerYear: Math.round(sorted.length / (daysSpan / 365)),
  }
}
