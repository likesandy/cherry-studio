import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock window.api
Object.defineProperty(global, 'window', {
  writable: true,
  value: {
    api: {
      preference: {
        get: vi.fn(),
        set: vi.fn(),
        getMultiple: vi.fn(),
        setMultiple: vi.fn(),
        getAll: vi.fn(),
        subscribe: vi.fn(),
        onChanged: vi.fn(() => vi.fn()) // cleanup function
      }
    }
  }
})

// Mock loggerService
vi.mock('@logger', () => ({
  loggerService: {
    withContext: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    })),
    initWindowSource: vi.fn()
  }
}))

// Import after mocks
import { usePreferenceService } from '../usePreference'

describe('usePreference hooks (simple)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('usePreferenceService', () => {
    it('should return the preference service instance', () => {
      const { result } = renderHook(() => usePreferenceService())

      // Should return a PreferenceService instance
      expect(result.current).toBeDefined()
      expect(typeof result.current.get).toBe('function')
      expect(typeof result.current.set).toBe('function')
      expect(typeof result.current.loadAll).toBe('function')
    })
  })

  describe('basic functionality', () => {
    it('should be able to import hooks', () => {
      // This test passes if the import at the top doesn't throw
      expect(typeof usePreferenceService).toBe('function')
    })
  })
})