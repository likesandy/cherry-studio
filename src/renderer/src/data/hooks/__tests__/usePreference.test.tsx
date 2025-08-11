import { renderHook, act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreferenceDefaultScopeType, PreferenceKeyType } from '@shared/data/types'
import { DefaultPreferences } from '@shared/data/preferences'

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

// Mock PreferenceService
const mockPreferenceService = {
  get: vi.fn(),
  set: vi.fn(),
  getMultiple: vi.fn(),
  setMultiple: vi.fn(),
  loadAll: vi.fn(),
  getCachedValue: vi.fn(),
  isCached: vi.fn(),
  subscribeToKey: vi.fn(),
  subscribe: vi.fn(),
  getSnapshot: vi.fn(),
  preload: vi.fn(),
  clearCache: vi.fn(),
  cleanup: vi.fn()
}

vi.mock('../PreferenceService', () => ({
  PreferenceService: {
    getInstance: vi.fn(() => mockPreferenceService)
  },
  preferenceService: mockPreferenceService
}))

// Import hooks after mocks
import { usePreference, usePreferences, usePreferencePreload, usePreferenceService } from '../usePreference'

describe('usePreference hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('usePreference', () => {
    it('should return undefined initially and load value asynchronously', async () => {
      const mockValue = 'dark'
      let subscribeCallback: () => void
      let getSnapshot: () => any

      // Setup mocks
      mockPreferenceService.subscribeToKey.mockImplementation((key) => (callback) => {
        subscribeCallback = callback
        return vi.fn() // unsubscribe function
      })
      
      mockPreferenceService.getSnapshot.mockImplementation((key) => () => {
        getSnapshot = mockPreferenceService.getSnapshot(key)
        return undefined // Initially undefined
      })
      
      mockPreferenceService.isCached.mockReturnValue(false)
      mockPreferenceService.get.mockResolvedValue(mockValue)

      const { result } = renderHook(() => usePreference('theme'))

      // Initially undefined
      expect(result.current[0]).toBeUndefined()

      // Should try to load value
      await waitFor(() => {
        expect(mockPreferenceService.get).toHaveBeenCalledWith('theme')
      })
    })

    it('should return cached value immediately', () => {
      const mockValue = 'dark'
      
      mockPreferenceService.subscribeToKey.mockImplementation((key) => (callback) => vi.fn())
      mockPreferenceService.getSnapshot.mockImplementation((key) => () => mockValue)
      mockPreferenceService.isCached.mockReturnValue(true)

      const { result } = renderHook(() => usePreference('theme'))

      expect(result.current[0]).toBe(mockValue)
      expect(mockPreferenceService.get).not.toHaveBeenCalled()
    })

    it('should update value when service notifies change', () => {
      let subscribeCallback: () => void
      const mockValue1 = 'light'
      const mockValue2 = 'dark'

      // Setup subscription mock
      mockPreferenceService.subscribeToKey.mockImplementation((key) => (callback) => {
        subscribeCallback = callback
        return vi.fn()
      })

      // Setup snapshot mock that changes
      let currentValue = mockValue1
      mockPreferenceService.getSnapshot.mockImplementation((key) => () => currentValue)
      mockPreferenceService.isCached.mockReturnValue(true)

      const { result, rerender } = renderHook(() => usePreference('theme'))

      // Initial value
      expect(result.current[0]).toBe(mockValue1)

      // Simulate service change
      currentValue = mockValue2
      act(() => {
        subscribeCallback()
      })
      rerender()

      expect(result.current[0]).toBe(mockValue2)
    })

    it('should provide setValue function that calls service', async () => {
      const newValue = 'dark'
      mockPreferenceService.subscribeToKey.mockImplementation((key) => (callback) => vi.fn())
      mockPreferenceService.getSnapshot.mockImplementation((key) => () => undefined)
      mockPreferenceService.set.mockResolvedValue(undefined)

      const { result } = renderHook(() => usePreference('theme'))

      await act(async () => {
        await result.current[1](newValue)
      })

      expect(mockPreferenceService.set).toHaveBeenCalledWith('theme', newValue)
    })

    it('should handle setValue errors', async () => {
      const error = new Error('Set failed')
      mockPreferenceService.subscribeToKey.mockImplementation((key) => (callback) => vi.fn())
      mockPreferenceService.getSnapshot.mockImplementation((key) => () => undefined)
      mockPreferenceService.set.mockRejectedValue(error)

      const { result } = renderHook(() => usePreference('theme'))

      await expect(act(async () => {
        await result.current[1]('dark')
      })).rejects.toThrow('Set failed')
    })

    it('should handle get errors gracefully', async () => {
      const error = new Error('Get failed')
      mockPreferenceService.subscribeToKey.mockImplementation((key) => (callback) => vi.fn())
      mockPreferenceService.getSnapshot.mockImplementation((key) => () => undefined)
      mockPreferenceService.isCached.mockReturnValue(false)
      mockPreferenceService.get.mockRejectedValue(error)

      renderHook(() => usePreference('theme'))

      // Error should be handled gracefully, we just verify the get was called
      await waitFor(() => {
        expect(mockPreferenceService.get).toHaveBeenCalledWith('theme')
      })
    })
  })

  describe('usePreferences', () => {
    it('should handle multiple preferences', () => {
      const keys = { ui: 'theme', lang: 'language' } as const
      const mockValues = { ui: 'dark', lang: 'en' }

      // Mock subscriptions for multiple keys
      mockPreferenceService.subscribeToKey.mockImplementation((key) => (callback) => vi.fn())
      mockPreferenceService.getCachedValue.mockImplementation((key) => {
        if (key === 'theme') return 'dark'
        if (key === 'language') return 'en'
        return undefined
      })

      const { result } = renderHook(() => usePreferences(keys))

      expect(result.current[0]).toEqual(mockValues)
    })

    it('should provide updateValues function for batch updates', async () => {
      const keys = { ui: 'theme', lang: 'language' } as const
      const updates = { ui: 'dark', lang: 'zh' }

      mockPreferenceService.subscribeToKey.mockImplementation((key) => (callback) => vi.fn())
      mockPreferenceService.getCachedValue.mockReturnValue(undefined)
      mockPreferenceService.setMultiple.mockResolvedValue(undefined)

      const { result } = renderHook(() => usePreferences(keys))

      await act(async () => {
        await result.current[1](updates)
      })

      expect(mockPreferenceService.setMultiple).toHaveBeenCalledWith({
        theme: 'dark',
        language: 'zh'
      })
    })

    it('should handle updateValues errors', async () => {
      const keys = { ui: 'theme' } as const
      const updates = { ui: 'dark' }
      const error = new Error('Update failed')

      mockPreferenceService.subscribeToKey.mockImplementation((key) => (callback) => vi.fn())
      mockPreferenceService.getCachedValue.mockReturnValue(undefined)
      mockPreferenceService.setMultiple.mockRejectedValue(error)

      const { result } = renderHook(() => usePreferences(keys))

      await expect(act(async () => {
        await result.current[1](updates)
      })).rejects.toThrow('Update failed')
    })

    it('should preload uncached keys', async () => {
      const keys = { ui: 'theme', lang: 'language' } as const
      
      mockPreferenceService.subscribeToKey.mockImplementation((key) => (callback) => vi.fn())
      mockPreferenceService.getCachedValue.mockReturnValue(undefined)
      mockPreferenceService.isCached.mockImplementation((key) => key === 'theme')
      mockPreferenceService.getMultiple.mockResolvedValue({ language: 'en' })

      renderHook(() => usePreferences(keys))

      await waitFor(() => {
        expect(mockPreferenceService.getMultiple).toHaveBeenCalledWith(['language'])
      })
    })

    it('should handle preload errors', async () => {
      const keys = { ui: 'theme' } as const
      const error = new Error('Preload failed')
      
      mockPreferenceService.subscribeToKey.mockImplementation((key) => (callback) => vi.fn())
      mockPreferenceService.getCachedValue.mockReturnValue(undefined)
      mockPreferenceService.isCached.mockReturnValue(false)
      mockPreferenceService.getMultiple.mockRejectedValue(error)

      renderHook(() => usePreferences(keys))

      // Error should be handled gracefully
      await waitFor(() => {
        expect(mockPreferenceService.getMultiple).toHaveBeenCalled()
      })
    })
  })

  describe('usePreferencePreload', () => {
    it('should preload specified keys', () => {
      const keys: PreferenceKeyType[] = ['theme', 'language']
      mockPreferenceService.preload.mockResolvedValue(undefined)

      renderHook(() => usePreferencePreload(keys))

      expect(mockPreferenceService.preload).toHaveBeenCalledWith(keys)
    })

    it('should handle preload errors', async () => {
      const keys: PreferenceKeyType[] = ['theme']
      const error = new Error('Preload failed')
      mockPreferenceService.preload.mockRejectedValue(error)

      renderHook(() => usePreferencePreload(keys))

      // Error should be handled gracefully
      await waitFor(() => {
        expect(mockPreferenceService.preload).toHaveBeenCalledWith(keys)
      })
    })

    it('should not preload when keys array changes reference but content is same', () => {
      const keys1: PreferenceKeyType[] = ['theme']
      const keys2: PreferenceKeyType[] = ['theme'] // Different reference, same content
      
      mockPreferenceService.preload.mockResolvedValue(undefined)

      const { rerender } = renderHook(
        ({ keys }) => usePreferencePreload(keys),
        { initialProps: { keys: keys1 } }
      )

      expect(mockPreferenceService.preload).toHaveBeenCalledTimes(1)

      // Rerender with same content but different reference
      rerender({ keys: keys2 })

      // Should not call preload again due to keysString dependency
      expect(mockPreferenceService.preload).toHaveBeenCalledTimes(1)
    })
  })

  describe('usePreferenceService', () => {
    it('should return the preference service instance', () => {
      const { result } = renderHook(() => usePreferenceService())

      expect(result.current).toBe(mockPreferenceService)
    })
  })

  describe('integration scenarios', () => {
    it('should work with real preference keys and types', () => {
      // Test with actual preference keys to ensure type safety
      const { result: themeResult } = renderHook(() => usePreference('theme'))
      const { result: langResult } = renderHook(() => usePreference('language'))
      
      mockPreferenceService.subscribeToKey.mockImplementation((key) => (callback) => vi.fn())
      mockPreferenceService.getSnapshot.mockImplementation((key) => () => {
        if (key === 'theme') return DefaultPreferences.default.theme
        if (key === 'language') return DefaultPreferences.default.language
        return undefined
      })

      // Type assertions should work
      expect(typeof themeResult.current[0]).toBe('string')
      expect(typeof langResult.current[0]).toBe('string')
    })

    it('should handle rapid successive updates', async () => {
      mockPreferenceService.subscribeToKey.mockImplementation((key) => (callback) => vi.fn())
      mockPreferenceService.getSnapshot.mockImplementation((key) => () => undefined)
      mockPreferenceService.set.mockResolvedValue(undefined)

      const { result } = renderHook(() => usePreference('theme'))

      // Rapid successive calls
      await act(async () => {
        await Promise.all([
          result.current[1]('dark'),
          result.current[1]('light'),
          result.current[1]('auto')
        ])
      })

      expect(mockPreferenceService.set).toHaveBeenCalledTimes(3)
    })
  })
})