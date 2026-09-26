// SVG path strings for chart marks.

const r2 = (n) => Math.round(n * 100) / 100

/**
 * A polyline through the points.
 * @param {Array<[number, number]>} points Pixel coordinates.
 * @returns {string}
 */
export const linePath = (points) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)} ${r2(y)}`).join('')

/**
 * The line closed down to a baseline, for an area wash.
 * @param {Array<[number, number]>} points Pixel coordinates, left to right.
 * @param {number} baseY
 * @returns {string}
 */
export function areaPath(points, baseY) {
  if (points.length === 0) return ''
  const first = points[0][0]
  const last = points[points.length - 1][0]
  return `${linePath(points)}L${r2(last)} ${r2(baseY)}L${r2(first)} ${r2(baseY)}Z`
}

/**
 * A bar with rounded corners at its data end and square corners at its base.
 * @param {number} x Left edge.
 * @param {number} baseY Pixel y of the end the bar grows from.
 * @param {number} endY Pixel y of the data end; above `baseY` for positive values.
 * @param {number} width
 * @param {number} radius Clamped to half the width and to the height; 0 for a plain rectangle.
 * @returns {string}
 */
export function barPath(x, baseY, endY, width, radius) {
  const top = Math.min(baseY, endY)
  const bottom = Math.max(baseY, endY)
  const r = Math.max(0, Math.min(radius, width / 2, bottom - top))
  const right = x + width
  if (r === 0) return `M${r2(x)} ${r2(top)}H${r2(right)}V${r2(bottom)}H${r2(x)}Z`
  if (endY <= baseY) {
    return `M${r2(x)} ${r2(bottom)}V${r2(top + r)}A${r} ${r} 0 0 1 ${r2(x + r)} ${r2(top)}H${r2(right - r)}A${r} ${r} 0 0 1 ${r2(right)} ${r2(top + r)}V${r2(bottom)}Z`
  }
  return `M${r2(x)} ${r2(top)}V${r2(bottom - r)}A${r} ${r} 0 0 0 ${r2(x + r)} ${r2(bottom)}H${r2(right - r)}A${r} ${r} 0 0 0 ${r2(right)} ${r2(bottom - r)}V${r2(top)}Z`
}
