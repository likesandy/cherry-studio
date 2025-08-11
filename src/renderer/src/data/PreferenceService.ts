import { loggerService } from '@logger'
import type { PreferencesType } from '@shared/data/preferences'
import { DefaultPreferences } from '@shared/data/preferences'

const logger = loggerService.withContext('PreferenceService')

type PreferenceKey = keyof PreferencesType['default']

/**
 * Renderer-side PreferenceService providing cached access to preferences
 * with real-time synchronization across windows using useSyncExternalStore
 */
export class PreferenceService {
  private static instance: PreferenceService
  private cache = new Map<string, any>()
  private listeners = new Set<() => void>()
  private keyListeners = new Map<string, Set<() => void>>()
  private changeListenerCleanup: (() => void) | null = null
  private subscribedKeys = new Set<string>()

  private constructor() {
    this.setupChangeListener()
    // Initialize window source for logging if not already done
    if (typeof loggerService.initWindowSource === 'function') {
      try {
        loggerService.initWindowSource('main')
      } catch (error) {
        // Window source already initialized, ignore error
      }
    }
  }

  /**
   * Get the singleton instance of PreferenceService
   */
  static getInstance(): PreferenceService {
    if (!PreferenceService.instance) {
      PreferenceService.instance = new PreferenceService()
    }
    return PreferenceService.instance
  }

  /**
   * Setup IPC change listener for preference updates from main process
   */
  private setupChangeListener() {
    if (!window.api?.preference?.onChanged) {
      logger.error('Preference API not available in preload context')
      return
    }

    this.changeListenerCleanup = window.api.preference.onChanged((key, value, scope) => {
      // Only handle default scope since we simplified API
      if (scope !== 'default') {
        return
      }

      const oldValue = this.cache.get(key)

      if (oldValue !== value) {
        this.cache.set(key, value)
        this.notifyListeners(key)
        logger.debug(`Preference ${key} updated to:`, { value })
      }
    })
  }

  /**
   * Notify all relevant listeners about preference changes
   */
  private notifyListeners(key: string) {
    // Notify global listeners
    this.listeners.forEach((listener) => listener())

    // Notify specific key listeners
    const keyListeners = this.keyListeners.get(key)
    if (keyListeners) {
      keyListeners.forEach((listener) => listener())
    }
  }

  /**
   * Get a single preference value with caching
   */
  async get<K extends PreferenceKey>(key: K): Promise<PreferencesType['default'][K]> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key)
    }

    try {
      // Fetch from main process if not cached
      const value = await window.api.preference.get(key)
      this.cache.set(key, value)

      // Auto-subscribe to this key for future updates
      if (!this.subscribedKeys.has(key)) {
        await this.subscribeToKeyInternal(key)
      }

      return value
    } catch (error) {
      logger.error(`Failed to get preference ${key}:`, error as Error)
      // Return default value on error
      return DefaultPreferences.default[key] as PreferencesType['default'][K]
    }
  }

  /**
   * Set a single preference value
   */
  async set<K extends PreferenceKey>(key: K, value: PreferencesType['default'][K]): Promise<void> {
    try {
      await window.api.preference.set(key, value)

      // Update local cache immediately for responsive UI
      this.cache.set(key, value)
      this.notifyListeners(key)

      logger.debug(`Preference ${key} set to:`, { value })
    } catch (error) {
      logger.error(`Failed to set preference ${key}:`, error as Error)
      throw error
    }
  }

  /**
   * Get multiple preferences at once
   */
  async getMultiple(keys: string[]): Promise<Record<string, any>> {
    // Check which keys are already cached
    const cachedResults: Record<string, any> = {}
    const uncachedKeys: string[] = []

    for (const key of keys) {
      if (this.cache.has(key)) {
        cachedResults[key] = this.cache.get(key)
      } else {
        uncachedKeys.push(key)
      }
    }

    // Fetch uncached keys from main process
    if (uncachedKeys.length > 0) {
      try {
        const uncachedResults = await window.api.preference.getMultiple(uncachedKeys)

        // Update cache with new results
        for (const [key, value] of Object.entries(uncachedResults)) {
          this.cache.set(key, value)
        }

        // Auto-subscribe to new keys
        for (const key of uncachedKeys) {
          if (!this.subscribedKeys.has(key)) {
            await this.subscribeToKeyInternal(key)
          }
        }

        return { ...cachedResults, ...uncachedResults }
      } catch (error) {
        logger.error('Failed to get multiple preferences:', error as Error)

        // Fill in default values for failed keys
        const defaultResults: Record<string, any> = {}
        for (const key of uncachedKeys) {
          if (key in DefaultPreferences.default) {
            defaultResults[key] = DefaultPreferences.default[key as PreferenceKey]
          }
        }

        return { ...cachedResults, ...defaultResults }
      }
    }

    return cachedResults
  }

  /**
   * Set multiple preferences at once
   */
  async setMultiple(updates: Record<string, any>): Promise<void> {
    try {
      await window.api.preference.setMultiple(updates)

      // Update local cache for all updated values
      for (const [key, value] of Object.entries(updates)) {
        this.cache.set(key, value)
        this.notifyListeners(key)
      }

      logger.debug(`Updated ${Object.keys(updates).length} preferences`)
    } catch (error) {
      logger.error('Failed to set multiple preferences:', error as Error)
      throw error
    }
  }

  /**
   * Subscribe to a specific key for change notifications
   */
  private async subscribeToKeyInternal(key: string): Promise<void> {
    if (!this.subscribedKeys.has(key)) {
      try {
        await window.api.preference.subscribe([key])
        this.subscribedKeys.add(key)
        logger.debug(`Subscribed to preference key: ${key}`)
      } catch (error) {
        logger.error(`Failed to subscribe to preference key ${key}:`, error as Error)
      }
    }
  }

  /**
   * Subscribe to global preference changes (for useSyncExternalStore)
   */
  subscribe = (callback: () => void): (() => void) => {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * Subscribe to specific key changes (for useSyncExternalStore)
   */
  subscribeToKey =
    (key: string) =>
    (callback: () => void): (() => void) => {
      if (!this.keyListeners.has(key)) {
        this.keyListeners.set(key, new Set())
      }

      const keyListeners = this.keyListeners.get(key)!
      keyListeners.add(callback)

      // Auto-subscribe to this key for updates
      this.subscribeToKeyInternal(key)

      return () => {
        keyListeners.delete(callback)
        if (keyListeners.size === 0) {
          this.keyListeners.delete(key)
        }
      }
    }

  /**
   * Get snapshot for useSyncExternalStore
   */
  getSnapshot =
    <K extends PreferenceKey>(key: K) =>
    (): PreferencesType['default'][K] | undefined => {
      return this.cache.get(key)
    }

  /**
   * Get cached value without async fetch
   */
  getCachedValue<K extends PreferenceKey>(key: K): PreferencesType['default'][K] | undefined {
    return this.cache.get(key)
  }

  /**
   * Check if a preference is cached
   */
  isCached(key: string): boolean {
    return this.cache.has(key)
  }

  /**
   * Preload specific preferences into cache
   */
  async preload(keys: string[]): Promise<void> {
    const uncachedKeys = keys.filter((key) => !this.isCached(key))

    if (uncachedKeys.length > 0) {
      try {
        const values = await this.getMultiple(uncachedKeys)
        logger.debug(`Preloaded ${Object.keys(values).length} preferences`)
      } catch (error) {
        logger.error('Failed to preload preferences:', error as Error)
      }
    }
  }

  /**
   * Clear all cached preferences (for testing/debugging)
   */
  clearCache(): void {
    this.cache.clear()
    logger.debug('Preference cache cleared')
  }

  /**
   * Get cache statistics (for debugging)
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * Cleanup service (call when shutting down)
   */
  cleanup(): void {
    if (this.changeListenerCleanup) {
      this.changeListenerCleanup()
      this.changeListenerCleanup = null
    }
    this.clearCache()
    this.listeners.clear()
    this.keyListeners.clear()
    this.subscribedKeys.clear()
  }
}

// Export singleton instance
export const preferenceService = PreferenceService.getInstance()
export default preferenceService
