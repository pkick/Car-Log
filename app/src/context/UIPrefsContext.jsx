import { createContext, useContext, useEffect, useState } from 'react'

const UIPrefsContext = createContext(null)

const STORAGE_KEY = 'odometer:ui-text-scale'
export const DEFAULT_TEXT_SCALE = 1
export const MIN_TEXT_SCALE = 0.8
export const MAX_TEXT_SCALE = 1.15

function clamp(value) {
  return Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, value))
}

function readStoredScale() {
  const stored = parseFloat(localStorage.getItem(STORAGE_KEY))
  return Number.isFinite(stored) ? clamp(stored) : DEFAULT_TEXT_SCALE
}

export function UIPrefsProvider({ children }) {
  const [textScale, setTextScaleState] = useState(readStoredScale)

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * textScale}px`
    localStorage.setItem(STORAGE_KEY, String(textScale))
  }, [textScale])

  const setTextScale = (value) => setTextScaleState(clamp(value))

  return (
    <UIPrefsContext.Provider value={{ textScale, setTextScale }}>
      {children}
    </UIPrefsContext.Provider>
  )
}

export function useUIPrefs() {
  const ctx = useContext(UIPrefsContext)
  if (!ctx) throw new Error('useUIPrefs must be used within UIPrefsProvider')
  return ctx
}
