import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreferenceDefaultScopeType, PreferenceKeyType } from '@shared/data/types'
import { DefaultPreferences } from '@shared/data/preferences'

// Mock window.api
const mockApi = {
  preference: {
    get: vi.fn(),
    set: vi.fn(),
    getMultiple: vi.fn(),
    setMultiple: vi.fn(),
    getAll: vi.fn(),
    subscribe: vi.fn(),
    onChanged: vi.fn()
  }
}

// Setup global mocks
Object.defineProperty(global, 'window', {
  writable: true,
  value: {
    api: mockApi
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

// Import after mocks are set up
import { PreferenceService } from '../PreferenceService'

describe('PreferenceService', () => {
  let service: PreferenceService
  let onChangedCallback: (key: PreferenceKeyType, value: any) => void

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Setup onChanged mock to capture callback
    mockApi.preference.onChanged.mockImplementation((callback) => {
      onChangedCallback = callback
      return vi.fn() // cleanup function
    })

    // Reset service instance
    ;(PreferenceService as any).instance = undefined
    service = PreferenceService.getInstance()
  })

  afterEach(() => {
    // Clear cache and cleanup
    service.clearCache()
    service.cleanup()
  })

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const service1 = PreferenceService.getInstance()
      const service2 = PreferenceService.getInstance()
      expect(service1).toBe(service2)
    })
  })

  describe('cache management', () => {
    it('should initialize with empty cache', () => {
      expect(service.isCached('theme')).toBe(false)
      expect(service.isFullyCached()).toBe(false)
    })

    it('should clear cache correctly', () => {
      // Manually add something to cache first
      service['cache']['theme'] = 'dark'
      service['fullCacheLoaded'] = true
      
      expect(service.isCached('theme')).toBe(true)
      expect(service.isFullyCached()).toBe(true)

      service.clearCache()

      expect(service.isCached('theme')).toBe(false)
      expect(service.isFullyCached()).toBe(false)
    })
  })

  describe('get method', () => {
    it('should return cached value if available', async () => {
      const mockValue = 'dark'
      service['cache']['theme'] = mockValue

      const result = await service.get('theme')

      expect(result).toBe(mockValue)
      expect(mockApi.preference.get).not.toHaveBeenCalled()
    })

    it('should fetch from API if not cached', async () => {
      const mockValue = 'light'
      mockApi.preference.get.mockResolvedValue(mockValue)
      mockApi.preference.subscribe.mockResolvedValue(undefined)

      const result = await service.get('theme')

      expect(result).toBe(mockValue)
      expect(mockApi.preference.get).toHaveBeenCalledWith('theme')
      expect(service.isCached('theme')).toBe(true)
    })

    it('should return default value on API error', async () => {
      const error = new Error('API error')
      mockApi.preference.get.mockRejectedValue(error)

      const result = await service.get('theme')

      expect(result).toBe(DefaultPreferences.default.theme)
      // Logger error should have been called (we can't easily access the mock instance)
      expect(mockApi.preference.get).toHaveBeenCalledWith('theme')
    })

    it('should auto-subscribe to key when first accessed', async () => {
      mockApi.preference.get.mockResolvedValue('dark')
      mockApi.preference.subscribe.mockResolvedValue(undefined)

      await service.get('theme')

      expect(mockApi.preference.subscribe).toHaveBeenCalledWith(['theme'])
    })
  })

  describe('set method', () => {
    it('should update cache and call API', async () => {
      const newValue = 'dark'
      mockApi.preference.set.mockResolvedValue(undefined)

      await service.set('theme', newValue)

      expect(mockApi.preference.set).toHaveBeenCalledWith('theme', newValue)
      expect(service.getCachedValue('theme')).toBe(newValue)
    })

    it('should throw error if API call fails', async () => {
      const error = new Error('API error')
      mockApi.preference.set.mockRejectedValue(error)

      await expect(service.set('theme', 'dark')).rejects.toThrow('API error')
    })
  })

  describe('getMultiple method', () => {
    it('should return cached values for cached keys', async () => {
      service['cache']['theme'] = 'dark'
      service['cache']['language'] = 'en'

      const result = await service.getMultiple(['theme', 'language'])

      expect(result).toEqual({
        theme: 'dark',
        language: 'en'
      })
      expect(mockApi.preference.getMultiple).not.toHaveBeenCalled()
    })

    it('should fetch uncached keys from API', async () => {
      service['cache']['theme'] = 'dark'
      const mockApiResponse = { language: 'zh' }
      mockApi.preference.getMultiple.mockResolvedValue(mockApiResponse)
      mockApi.preference.subscribe.mockResolvedValue(undefined)

      const result = await service.getMultiple(['theme', 'language'])

      expect(result).toEqual({
        theme: 'dark',
        language: 'zh'
      })
      expect(mockApi.preference.getMultiple).toHaveBeenCalledWith(['language'])
      expect(service.isCached('language')).toBe(true)
    })

    it('should handle API errors gracefully', async () => {
      const error = new Error('API error')
      mockApi.preference.getMultiple.mockRejectedValue(error)

      const result = await service.getMultiple(['theme'])

      // Should return defaults for failed keys
      expect(result).toEqual({
        theme: DefaultPreferences.default.theme
      })
    })
  })

  describe('setMultiple method', () => {
    it('should update cache and call API', async () => {
      const updates = { theme: 'dark', language: 'zh' } as Partial<PreferenceDefaultScopeType>
      mockApi.preference.setMultiple.mockResolvedValue(undefined)

      await service.setMultiple(updates)

      expect(mockApi.preference.setMultiple).toHaveBeenCalledWith(updates)
      expect(service.getCachedValue('theme')).toBe('dark')
      expect(service.getCachedValue('language')).toBe('zh')
    })

    it('should throw error if API call fails', async () => {
      const updates = { theme: 'dark' } as Partial<PreferenceDefaultScopeType>
      const error = new Error('API error')
      mockApi.preference.setMultiple.mockRejectedValue(error)

      await expect(service.setMultiple(updates)).rejects.toThrow('API error')
    })
  })

  describe('loadAll method', () => {
    it('should load all preferences and mark cache as full', async () => {
      const mockAllPreferences: PreferenceDefaultScopeType = {
        ...DefaultPreferences.default,
        theme: 'dark',
        language: 'zh'
      }
      mockApi.preference.getAll.mockResolvedValue(mockAllPreferences)
      mockApi.preference.subscribe.mockResolvedValue(undefined)

      const result = await service.loadAll()

      expect(result).toEqual(mockAllPreferences)
      expect(service.isFullyCached()).toBe(true)
      expect(service.getCachedValue('theme')).toBe('dark')
      expect(service.getCachedValue('language')).toBe('zh')
      
      // Should auto-subscribe to all keys
      const expectedKeys = Object.keys(mockAllPreferences)
      expect(mockApi.preference.subscribe).toHaveBeenCalledTimes(expectedKeys.length)
    })

    it('should throw error if API call fails', async () => {
      const error = new Error('API error')
      mockApi.preference.getAll.mockRejectedValue(error)

      await expect(service.loadAll()).rejects.toThrow('API error')
      expect(service.isFullyCached()).toBe(false)
    })
  })

  describe('change notifications', () => {
    it('should update cache when change notification received', () => {
      const newValue = 'dark'
      service['cache']['theme'] = 'light' // Set initial value

      // Simulate change notification
      onChangedCallback('theme', newValue)

      expect(service.getCachedValue('theme')).toBe(newValue)
    })

    it('should not update cache if value is the same', () => {
      const value = 'dark'
      service['cache']['theme'] = value
      const notifyListenersSpy = vi.spyOn(service as any, 'notifyListeners')

      // Simulate change notification with same value
      onChangedCallback('theme', value)

      expect(notifyListenersSpy).not.toHaveBeenCalled()
    })
  })

  describe('subscriptions', () => {
    it('should subscribe to key changes for useSyncExternalStore', () => {
      const callback = vi.fn()
      const unsubscribe = service.subscribeToKey('theme')(callback)

      // Trigger change
      onChangedCallback('theme', 'dark')

      expect(callback).toHaveBeenCalled()

      // Test unsubscribe
      unsubscribe()
      callback.mockClear()
      onChangedCallback('theme', 'light')
      expect(callback).not.toHaveBeenCalled()
    })

    it('should provide snapshot for useSyncExternalStore', () => {
      service['cache']['theme'] = 'dark'
      
      const snapshot = service.getSnapshot('theme')()
      
      expect(snapshot).toBe('dark')
    })

    it('should subscribe globally', () => {
      const callback = vi.fn()
      const unsubscribe = service.subscribe(callback)

      // Trigger change
      onChangedCallback('theme', 'dark')

      expect(callback).toHaveBeenCalled()

      // Test unsubscribe
      unsubscribe()
      callback.mockClear()
      onChangedCallback('theme', 'light')
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('utility methods', () => {
    it('should check if key is cached', () => {
      expect(service.isCached('theme')).toBe(false)
      
      service['cache']['theme'] = 'dark'
      expect(service.isCached('theme')).toBe(true)
    })

    it('should get cached value without API call', () => {
      expect(service.getCachedValue('theme')).toBeUndefined()
      
      service['cache']['theme'] = 'dark'
      expect(service.getCachedValue('theme')).toBe('dark')
    })

    it('should preload specific keys', async () => {
      const getMultipleSpy = vi.spyOn(service, 'getMultiple')
      getMultipleSpy.mockResolvedValue({ theme: 'dark' })

      await service.preload(['theme', 'language'])

      expect(getMultipleSpy).toHaveBeenCalledWith(['theme', 'language'])
    })

    it('should not preload already cached keys', async () => {
      service['cache']['theme'] = 'dark' // Pre-cache one key
      const getMultipleSpy = vi.spyOn(service, 'getMultiple')
      getMultipleSpy.mockResolvedValue({ language: 'zh' })

      await service.preload(['theme', 'language'])

      // Should only preload the uncached key
      expect(getMultipleSpy).toHaveBeenCalledWith(['language'])
    })
  })

  describe('cleanup', () => {
    it('should cleanup properly', () => {
      const mockCleanup = vi.fn()
      service['changeListenerCleanup'] = mockCleanup
      const clearCacheSpy = vi.spyOn(service, 'clearCache')

      service.cleanup()

      expect(mockCleanup).toHaveBeenCalled()
      expect(clearCacheSpy).toHaveBeenCalled()
      expect(service['changeListenerCleanup']).toBeNull()
    })
  })
})