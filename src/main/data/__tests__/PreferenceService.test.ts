import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreferenceDefaultScopeType, PreferenceKeyType } from '@shared/data/types'
import { DefaultPreferences } from '@shared/data/preferences'

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: {
    fromId: vi.fn(),
    getAllWindows: vi.fn(() => [])
  }
}))

// Mock loggerService
vi.mock('@logger', () => ({
  loggerService: {
    withContext: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    }))
  }
}))

// Mock DbService
vi.mock('../db/DbService', () => ({
  default: {
    getDb: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis()
    })),
    transaction: vi.fn()
  }
}))

// Mock preference table
vi.mock('../db/schemas/preference', () => ({
  preferenceTable: {
    scope: 'scope',
    key: 'key', 
    value: 'value'
  }
}))

// Import after mocks
import { PreferenceService } from '../PreferenceService'
import { BrowserWindow } from 'electron'

describe('Main PreferenceService', () => {
  let service: PreferenceService

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset singleton instance
    ;(PreferenceService as any).instance = undefined
    service = PreferenceService.getInstance()

    // Default mock implementations
    mockDb.select.mockReturnValue(Promise.resolve([]))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const service1 = PreferenceService.getInstance()
      const service2 = PreferenceService.getInstance()
      expect(service1).toBe(service2)
    })
  })

  describe('initialization', () => {
    it('should initialize cache from database', async () => {
      const mockDbData = [
        { key: 'theme', value: 'dark' },
        { key: 'language', value: 'zh' }
      ]
      
      mockDb.select.mockResolvedValue(mockDbData)

      await service.initialize()

      expect(mockDb.select).toHaveBeenCalled()
      expect(service.get('theme')).toBe('dark')
      expect(service.get('language')).toBe('zh')
    })

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('DB error')
      mockDb.select.mockRejectedValue(error)

      await service.initialize()

      // Should still be initialized with defaults
      expect(service.get('theme')).toBe(DefaultPreferences.default.theme)
    })

    it('should not reinitialize if already initialized', async () => {
      await service.initialize()
      mockDb.select.mockClear()
      
      await service.initialize()
      
      expect(mockDb.select).not.toHaveBeenCalled()
    })
  })

  describe('get method', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should return cached value after initialization', () => {
      const result = service.get('theme')
      expect(result).toBe(DefaultPreferences.default.theme)
    })

    it('should return default value if cache not initialized', () => {
      // Create new uninitialised service
      ;(PreferenceService as any).instance = undefined
      const newService = PreferenceService.getInstance()
      
      const result = newService.get('theme')
      expect(result).toBe(DefaultPreferences.default.theme)
    })
  })

  describe('set method', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should update existing preference in database and cache', async () => {
      const newValue = 'dark'
      
      // Mock existing record
      mockDb.select.mockResolvedValue([{ key: 'theme', value: 'light' }])
      
      await service.set('theme', newValue)

      expect(mockDb.update).toHaveBeenCalled()
      expect(service.get('theme')).toBe(newValue)
    })

    it('should insert new preference if not exists', async () => {
      const newValue = 'dark'
      
      // Mock no existing record
      mockDb.select.mockResolvedValue([])
      
      await service.set('theme', newValue)

      expect(mockDb.insert).toHaveBeenCalled()
      expect(service.get('theme')).toBe(newValue)
    })

    it('should throw error on database failure', async () => {
      const error = new Error('DB error')
      mockDb.select.mockRejectedValue(error)

      await expect(service.set('theme', 'dark')).rejects.toThrow('DB error')
    })
  })

  describe('getMultiple method', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should return multiple preferences from cache', () => {
      const result = service.getMultiple(['theme', 'language'])
      
      expect(result.theme).toBe(DefaultPreferences.default.theme)
      expect(result.language).toBe(DefaultPreferences.default.language)
    })

    it('should handle uninitialised cache', () => {
      // Create uninitialised service
      ;(PreferenceService as any).instance = undefined
      const newService = PreferenceService.getInstance()
      
      const result = newService.getMultiple(['theme'])
      expect(result.theme).toBe(DefaultPreferences.default.theme)
    })
  })

  describe('setMultiple method', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should update multiple preferences in transaction', async () => {
      const updates = { theme: 'dark', language: 'zh' } as Partial<PreferenceDefaultScopeType>
      
      // Mock transaction
      mockDbService.transaction.mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(), 
          where: vi.fn().mockReturnThis()
        }
        await callback(mockTx)
      })

      await service.setMultiple(updates)

      expect(mockDbService.transaction).toHaveBeenCalled()
      expect(service.get('theme')).toBe('dark')
      expect(service.get('language')).toBe('zh')
    })

    it('should throw error on database failure', async () => {
      const error = new Error('Transaction failed')
      mockDbService.transaction.mockRejectedValue(error)

      const updates = { theme: 'dark' } as Partial<PreferenceDefaultScopeType>
      
      await expect(service.setMultiple(updates)).rejects.toThrow('Transaction failed')
    })
  })

  describe('getAll method', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should return complete preference object', () => {
      const result = service.getAll()
      
      expect(result).toEqual(expect.objectContaining({
        theme: expect.any(String),
        language: expect.any(String)
      }))
    })

    it('should return defaults if not initialised', () => {
      ;(PreferenceService as any).instance = undefined
      const newService = PreferenceService.getInstance()
      
      const result = newService.getAll()
      expect(result).toEqual(DefaultPreferences.default)
    })
  })

  describe('subscriptions', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should add window subscription', () => {
      const windowId = 123
      const keys = ['theme', 'language']

      service.subscribe(windowId, keys)

      const subscriptions = service.getSubscriptions()
      expect(subscriptions.has(windowId)).toBe(true)
      expect(subscriptions.get(windowId)).toEqual(new Set(keys))
    })

    it('should remove window subscription', () => {
      const windowId = 123
      service.subscribe(windowId, ['theme'])
      
      service.unsubscribe(windowId)

      const subscriptions = service.getSubscriptions()
      expect(subscriptions.has(windowId)).toBe(false)
    })

    it('should handle notification to valid window', async () => {
      const windowId = 123
      const mockWindow = {
        isDestroyed: vi.fn(() => false),
        webContents: {
          send: vi.fn()
        }
      }
      
      ;(BrowserWindow.fromId as any).mockReturnValue(mockWindow)
      service.subscribe(windowId, ['theme'])

      await service.set('theme', 'dark')

      expect(mockWindow.webContents.send).toHaveBeenCalled()
    })

    it('should cleanup invalid window subscriptions', async () => {
      const windowId = 123
      ;(BrowserWindow.fromId as any).mockReturnValue(null) // Invalid window
      service.subscribe(windowId, ['theme'])

      await service.set('theme', 'dark')

      // Subscription should be removed
      const subscriptions = service.getSubscriptions()
      expect(subscriptions.has(windowId)).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should handle set with invalid key', async () => {
      await service.initialize()
      
      // This should fail validation
      await expect(service.set('invalidKey' as any, 'value')).rejects.toThrow()
    })
  })
})