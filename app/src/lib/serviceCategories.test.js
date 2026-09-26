import { describe, expect, it } from 'vitest'
import { CATEGORY_ID_BY_SERVICE, SUBCATEGORIES } from './serviceCategories'

describe('CATEGORY_ID_BY_SERVICE', () => {
  it('files a service listed under two categories under the first one', () => {
    expect(SUBCATEGORIES.brakes).toContain('Brake fluid')
    expect(SUBCATEGORIES.fluids).toContain('Brake fluid')
    expect(CATEGORY_ID_BY_SERVICE['Brake fluid']).toBe('brakes')
  })

  it('maps every listed service to a category that lists it', () => {
    for (const [service, categoryId] of Object.entries(CATEGORY_ID_BY_SERVICE)) {
      expect(SUBCATEGORIES[categoryId]).toContain(service)
    }
  })
})
