/**
 * Joins class names, skipping falsy entries.
 * @param {...(string | false | null | undefined)} parts
 * @returns {string}
 */
export const cx = (...parts) => parts.filter(Boolean).join(' ')

/** Keyboard focus outline shared by every interactive primitive. */
export const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** Focus ring drawn inside the element, for controls whose parent clips overflow. */
export const FOCUS_RING_INSET = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent'
