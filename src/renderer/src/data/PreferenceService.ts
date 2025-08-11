import { loggerService } from '@logger'
import { DefaultPreferences } from '@shared/data/preferences'
import type { PreferenceDefaultScopeType, PreferenceKeyType } from '@shared/data/types'

const logger = loggerService.withContext('PreferenceService')

/**
 * Renderer-side PreferenceService providing cached access to preferences
 * with real-time synchronization across windows using useSyncExternalStore
 */
export class PreferenceService {
  private static instance: PreferenceService
  private cache: Partial<PreferenceDefaultScopeType> = {}
  private listeners = new Set<() => void>()
  private keyListeners = new Map<string, Set<() => void>>()
  private changeListenerCleanup: (() => void) | null = null
  private subscribedKeys = new Set<string>()
  private fullCacheLoaded = false

  private constructor() {
    this.setupChangeListener()
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

    this.changeListenerCleanup = window.api.preference.onChanged((key, value) => {
      const oldValue = this.cache[key]

      if (oldValue !== value) {
        this.cache[key] = value
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
  async get<K extends PreferenceKeyType>(key: K): Promise<PreferenceDefaultScopeType[K]> {
    // Check cache first
    if (key in this.cache && this.cache[key] !== undefined) {
      return this.cache[key] as PreferenceDefaultScopeType[K]
    }

    try {
      // Fetch from main process if not cached
      const value = await window.api.preference.get(key)
      this.cache[key] = value

      // Auto-subscribe to this key for future updates
      if (!this.subscribedKeys.has(key)) {
        await this.subscribeToKeyInternal(key)
      }

      return value
    } catch (error) {
      logger.error(`Failed to get preference ${key}:`, error as Error)
      // Return default value on error
      return DefaultPreferences.default[key] as PreferenceDefaultScopeType[K]
    }
  }

  /**
   * Set a single preference value
   */
  async set<K extends PreferenceKeyType>(key: K, value: PreferenceDefaultScopeType[K]): Promise<void> {
    try {
      await window.api.preference.set(key, value)

      // Update local cache immediately for responsive UI
      this.cache[key] = value
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
  async getMultiple(keys: PreferenceKeyType[]): Promise<Record<string, any>> {
    // Check which keys are already cached
    const cachedResults: Partial<PreferenceDefaultScopeType> = {}
    const uncachedKeys: PreferenceKeyType[] = []

    for (const key of keys) {
      if (key in this.cache && this.cache[key] !== undefined) {
        ;(cachedResults as any)[key] = this.cache[key]
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
          ;(this.cache as any)[key] = value
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
            defaultResults[key] = DefaultPreferences.default[key as PreferenceKeyType]
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
  async setMultiple(updates: Partial<PreferenceDefaultScopeType>): Promise<void> {
    try {
      await window.api.preference.setMultiple(updates)

      // Update local cache for all updated values
      for (const [key, value] of Object.entries(updates)) {
        ;(this.cache as any)[key] = value
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
  private async subscribeToKeyInternal(key: PreferenceKeyType): Promise<void> {
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
    (key: PreferenceKeyType) =>
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
    <K extends PreferenceKeyType>(key: K) =>
    (): PreferenceDefaultScopeType[K] | undefined => {
      return this.cache[key]
    }

  /**
   * Get cached value without async fetch
   */
  getCachedValue<K extends PreferenceKeyType>(key: K): PreferenceDefaultScopeType[K] | undefined {
    return this.cache[key]
  }

  /**
   * Check if a preference is cached
   */
  isCached(key: PreferenceKeyType): boolean {
    return key in this.cache && this.cache[key] !== undefined
  }

  /**
   * Load all preferences from main process at once
   * Provides optimal performance by loading complete preference set into memory
   */
  async loadAll(): Promise<PreferenceDefaultScopeType> {
    try {
      const allPreferences = await window.api.preference.getAll()

      // Update local cache with all preferences
      for (const [key, value] of Object.entries(allPreferences)) {
        ;(this.cache as any)[key] = value

        // Auto-subscribe to this key if not already subscribed
        if (!this.subscribedKeys.has(key)) {
          await this.subscribeToKeyInternal(key as PreferenceKeyType)
        }
      }

      this.fullCacheLoaded = true
      logger.info(`Loaded all ${Object.keys(allPreferences).length} preferences into cache`)

      return allPreferences
    } catch (error) {
      logger.error('Failed to load all preferences:', error as Error)
      throw error
    }
  }

  /**
   * Check if all preferences are loaded in cache
   */
  isFullyCached(): boolean {
    return this.fullCacheLoaded
  }

  /**
   * Preload specific preferences into cache
   */
  async preload(keys: PreferenceKeyType[]): Promise<void> {
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
    this.cache = {}
    this.fullCacheLoaded = false
    logger.debug('Preference cache cleared')
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
