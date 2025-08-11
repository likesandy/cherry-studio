import { describe, expect, it, vi } from 'vitest'

// Mock all dependencies
vi.mock('electron', () => ({
  BrowserWindow: {
    fromId: vi.fn(),
    getAllWindows: vi.fn(() => [])
  }
}))

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

vi.mock('../db/DbService', () => ({
  default: {
    getDb: vi.fn(() => ({
      select: vi.fn().mockReturnValue(Promise.resolve([])),
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

vi.mock('../db/schemas/preference', () => ({
  preferenceTable: {
    scope: 'scope',
    key: 'key',
    value: 'value'
  }
}))

// Import after mocks
import { PreferenceService } from '../PreferenceService'
import { DefaultPreferences } from '@shared/data/preferences'

describe('Main PreferenceService (simple)', () => {
  describe('basic functionality', () => {
    it('should create singleton instance', () => {
      const service1 = PreferenceService.getInstance()
      const service2 = PreferenceService.getInstance()
      
      expect(service1).toBe(service2)
      expect(service1).toBeInstanceOf(PreferenceService)
    })

    it('should return default values before initialization', () => {
      // Reset instance
      ;(PreferenceService as any).instance = undefined
      const service = PreferenceService.getInstance()
      
      const theme = service.get('theme')
      const language = service.get('language')
      
      expect(theme).toBe(DefaultPreferences.default.theme)
      expect(language).toBe(DefaultPreferences.default.language)
    })

    it('should initialize without errors', async () => {
      const service = PreferenceService.getInstance()
      
      await expect(service.initialize()).resolves.not.toThrow()
    })

    it('should have getAll method', () => {
      const service = PreferenceService.getInstance()
      
      // Method should exist
      expect(typeof service.getAll).toBe('function')
      
      // Should return an object (even if not initialized, should return defaults)
      const all = service.getAll()
      expect(all).toBeDefined()
      expect(typeof all).toBe('object')
    })

    it('should have subscription methods', () => {
      const service = PreferenceService.getInstance()
      
      expect(typeof service.subscribe).toBe('function')
      expect(typeof service.unsubscribe).toBe('function')
      expect(typeof service.getSubscriptions).toBe('function')
    })

    it('should handle multiple preferences', () => {
      const service = PreferenceService.getInstance()
      
      const result = service.getMultiple(['theme', 'language'])
      
      expect(result).toHaveProperty('theme')
      expect(result).toHaveProperty('language')
      expect(result.theme).toBe(DefaultPreferences.default.theme)
      expect(result.language).toBe(DefaultPreferences.default.language)
    })
  })

  describe('type safety', () => {
    it('should have proper method signatures', () => {
      const service = PreferenceService.getInstance()
      
      // These should work with valid keys (method existence check)
      expect(typeof service.get).toBe('function')
      expect(typeof service.set).toBe('function')
      expect(typeof service.getMultiple).toBe('function')
      expect(typeof service.setMultiple).toBe('function')
      
      // Methods should not throw when called (they return defaults)
      expect(() => service.get('theme')).not.toThrow()
      expect(() => service.get('language')).not.toThrow()
    })
  })
})