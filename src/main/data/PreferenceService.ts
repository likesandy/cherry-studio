import { dbService } from '@data/db/DbService'
import { loggerService } from '@logger'
import { DefaultPreferences } from '@shared/data/preferences'
import type { PreferenceDefaultScopeType, PreferenceKeyType } from '@shared/data/types'
import { IpcChannel } from '@shared/IpcChannel'
import { and, eq } from 'drizzle-orm'
import { BrowserWindow, ipcMain } from 'electron'
import { EventEmitter } from 'events'

import { preferenceTable } from './db/schemas/preference'

const logger = loggerService.withContext('PreferenceService')

type MultiPreferencesResultType<K extends PreferenceKeyType> = { [P in K]: PreferenceDefaultScopeType[P] | undefined }

const DefaultScope = 'default'
/**
 * PreferenceService manages preference data storage and synchronization across multiple windows
 *
 * Features:
 * - Memory-cached preferences for high performance
 * - SQLite database persistence using Drizzle ORM
 * - Multi-window subscription and synchronization
 * - Main process change notification support
 * - Type-safe preference operations
 * - Batch operations support
 * - Unified change notification broadcasting
 */
export class PreferenceService {
  private static instance: PreferenceService
  private subscriptions = new Map<number, Set<string>>() // windowId -> Set<keys>
  private cache: PreferenceDefaultScopeType = DefaultPreferences.default
  private initialized = false

  private static isIpcHandlerRegistered = false

  // EventEmitter for main process change notifications
  private mainEventEmitter = new EventEmitter()

  private constructor() {
    this.setupWindowCleanup()
  }

  /**
   * Get the singleton instance of PreferenceService
   */
  public static getInstance(): PreferenceService {
    if (!PreferenceService.instance) {
      PreferenceService.instance = new PreferenceService()
    }
    return PreferenceService.instance
  }

  /**
   * Initialize preference cache from database
   * Should be called once at application startup
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      const db = dbService.getDb()
      const results = await db.select().from(preferenceTable).where(eq(preferenceTable.scope, DefaultScope))

      // Update cache with database values, keeping defaults for missing keys
      for (const result of results) {
        const key = result.key
        if (key in this.cache) {
          this.cache[key] = result.value
        }
      }

      this.initialized = true
      logger.info(`Preference cache initialized with ${results.length} values`)
    } catch (error) {
      logger.error('Failed to initialize preference cache:', error as Error)
      // Keep default values on initialization failure
      this.initialized = false
    }
  }

  /**
   * Get a single preference value from memory cache
   * Fast synchronous access - no database queries after initialization
   */
  public get<K extends PreferenceKeyType>(key: K): PreferenceDefaultScopeType[K] {
    if (!this.initialized) {
      logger.warn(`Preference cache not initialized, returning default for ${key}`)
      return DefaultPreferences.default[key]
    }

    return this.cache[key] ?? DefaultPreferences.default[key]
  }

  /**
   * Get a single preference value from memory cache and subscribe to changes
   * @param key - The preference key to get
   * @param callback - The callback function to call when the preference changes
   * @returns The current value of the preference
   */
  public getAndSubscribeChange<K extends PreferenceKeyType>(
    key: K,
    callback: (newValue: PreferenceDefaultScopeType[K], oldValue?: PreferenceDefaultScopeType[K]) => void
  ): PreferenceDefaultScopeType[K] {
    const value = this.get(key)
    this.subscribeChange(key, callback)
    return value
  }
  /**
   * Set a single preference value
   * Updates both database and memory cache, then broadcasts changes to all listeners
   * Optimized to skip database writes and notifications when value hasn't changed
   */
  public async set<K extends PreferenceKeyType>(key: K, value: PreferenceDefaultScopeType[K]): Promise<void> {
    try {
      if (!(key in this.cache)) {
        throw new Error(`Preference ${key} not found in cache`)
      }

      const oldValue = this.cache[key] // Save old value for notification

      // Performance optimization: skip update if value hasn't changed
      if (this.isEqual(oldValue, value)) {
        logger.debug(`Preference ${key} value unchanged, skipping database write and notification`)
        return
      }

      await dbService
        .getDb()
        .update(preferenceTable)
        .set({
          value: value as any
        })
        .where(and(eq(preferenceTable.scope, DefaultScope), eq(preferenceTable.key, key)))

      // Update memory cache immediately
      this.cache[key] = value

      // Unified notification to both main and renderer processes
      await this.notifyChange(key, value, oldValue)

      logger.debug(`Preference ${key} updated successfully`)
    } catch (error) {
      logger.error(`Failed to set preference ${key}:`, error as Error)
      throw error
    }
  }

  /**
   * Get multiple preferences at once from memory cache
   * Fast synchronous access - no database queries
   */
  public getMultiple<K extends PreferenceKeyType>(keys: K[]): MultiPreferencesResultType<K> {
    if (!this.initialized) {
      logger.warn('Preference cache not initialized, returning defaults for multiple keys')
      const output: MultiPreferencesResultType<K> = {} as MultiPreferencesResultType<K>
      for (const key of keys) {
        if (key in DefaultPreferences.default) {
          output[key] = DefaultPreferences.default[key]
        } else {
          output[key] = undefined as MultiPreferencesResultType<K>[K]
        }
      }
      return output
    }

    const output: MultiPreferencesResultType<K> = {} as MultiPreferencesResultType<K>
    for (const key of keys) {
      if (key in this.cache) {
        output[key] = this.cache[key]
      } else {
        output[key] = undefined
      }
    }

    return output
  }

  /**
   * Set multiple preferences at once
   * Updates both database and memory cache in a transaction, then broadcasts changes
   * Optimized to skip unchanged values and reduce database operations
   */
  public async setMultiple(updates: Partial<PreferenceDefaultScopeType>): Promise<void> {
    try {
      // Performance optimization: filter out unchanged values
      const actualUpdates: Record<string, any> = {}
      const oldValues: Record<string, any> = {}
      let skippedCount = 0

      for (const [key, value] of Object.entries(updates)) {
        if (!(key in this.cache) || value === undefined || value === null) {
          throw new Error(`Preference ${key} not found in cache or value is undefined or null`)
        }

        const oldValue = this.cache[key]

        // Only include keys that actually changed
        if (!this.isEqual(oldValue, value)) {
          actualUpdates[key] = value
          oldValues[key] = oldValue
        } else {
          skippedCount++
        }
      }

      // Early return if no values actually changed
      if (Object.keys(actualUpdates).length === 0) {
        logger.debug(`All ${Object.keys(updates).length} preference values unchanged, skipping batch update`)
        return
      }

      // Only update items that actually changed
      await dbService.getDb().transaction(async (tx) => {
        for (const [key, value] of Object.entries(actualUpdates)) {
          await tx
            .update(preferenceTable)
            .set({
              value
            })
            .where(and(eq(preferenceTable.scope, DefaultScope), eq(preferenceTable.key, key)))
        }
      })

      // Update memory cache for changed keys only
      for (const [key, value] of Object.entries(actualUpdates)) {
        if (key in this.cache) {
          this.cache[key] = value
        }
      }

      // Unified batch notification for changed values only
      const changePromises = Object.entries(actualUpdates).map(([key, value]) =>
        this.notifyChange(key, value, oldValues[key])
      )
      await Promise.all(changePromises)

      logger.debug(
        `Updated ${Object.keys(actualUpdates).length}/${Object.keys(updates).length} preferences successfully (${skippedCount} unchanged)`
      )
    } catch (error) {
      logger.error('Failed to set multiple preferences:', error as Error)
      throw error
    }
  }

  /**
   * Subscribe a window to preference changes
   * Window will receive notifications for specified keys
   */
  public subscribeForWindow(windowId: number, keys: string[]): void {
    if (!this.subscriptions.has(windowId)) {
      this.subscriptions.set(windowId, new Set())
    }

    const windowKeys = this.subscriptions.get(windowId)!
    keys.forEach((key) => windowKeys.add(key))

    logger.debug(`Window ${windowId} subscribed to ${keys.length} preference keys`)
  }

  /**
   * Unsubscribe a window from preference changes
   */
  public unsubscribeForWindow(windowId: number): void {
    this.subscriptions.delete(windowId)
    logger.debug(`Window ${windowId} unsubscribed from preference changes`)
  }

  /**
   * Subscribe to preference changes in main process
   * Returns unsubscribe function for cleanup
   */
  public subscribeChange<K extends PreferenceKeyType>(
    key: K,
    callback: (newValue: PreferenceDefaultScopeType[K], oldValue?: PreferenceDefaultScopeType[K]) => void
  ): () => void {
    const listener = (changedKey: string, newValue: any, oldValue: any) => {
      if (changedKey === key) {
        callback(newValue as PreferenceDefaultScopeType[K], oldValue as PreferenceDefaultScopeType[K])
      }
    }

    this.mainEventEmitter.on('preference-changed', listener)

    return () => {
      this.mainEventEmitter.off('preference-changed', listener)
    }
  }

  /**
   * Subscribe to multiple preference changes in main process
   * Returns unsubscribe function for cleanup
   */
  public subscribeMultipleChanges(
    keys: PreferenceKeyType[],
    callback: (key: PreferenceKeyType, newValue: any, oldValue: any) => void
  ): () => void {
    const listener = (changedKey: string, newValue: any, oldValue: any) => {
      if (keys.includes(changedKey as PreferenceKeyType)) {
        callback(changedKey as PreferenceKeyType, newValue, oldValue)
      }
    }

    this.mainEventEmitter.on('preference-changed', listener)

    return () => {
      this.mainEventEmitter.off('preference-changed', listener)
    }
  }

  /**
   * Remove all main process listeners for cleanup
   */
  public removeAllChangeListeners(): void {
    this.mainEventEmitter.removeAllListeners('preference-changed')
    logger.debug('Removed all main process preference listeners')
  }

  /**
   * Get main process listener count for debugging
   */
  public getChangeListenerCount(): number {
    return this.mainEventEmitter.listenerCount('preference-changed')
  }

  /**
   * Unified notification method for both main and renderer processes
   * Broadcasts preference changes to main process listeners and subscribed renderer windows
   */
  private async notifyChange(key: string, value: any, oldValue?: any): Promise<void> {
    // 1. Notify main process listeners
    this.mainEventEmitter.emit('preference-changed', key, value, oldValue)

    // 2. Notify renderer process windows
    const affectedWindows: number[] = []

    for (const [windowId, subscribedKeys] of this.subscriptions.entries()) {
      if (subscribedKeys.has(key)) {
        affectedWindows.push(windowId)
      }
    }

    if (affectedWindows.length === 0) {
      logger.debug(`Preference ${key} changed, notified main listeners only`)
      return
    }

    // Send to all affected renderer windows
    for (const windowId of affectedWindows) {
      try {
        const window = BrowserWindow.fromId(windowId)
        if (window && !window.isDestroyed()) {
          window.webContents.send(IpcChannel.Preference_Changed, key, value, DefaultScope)
        } else {
          // Clean up invalid window subscription
          this.subscriptions.delete(windowId)
        }
      } catch (error) {
        logger.error(`Failed to notify window ${windowId}:`, error as Error)
        this.subscriptions.delete(windowId)
      }
    }

    logger.debug(`Preference ${key} changed, notified main listeners and ${affectedWindows.length} renderer windows`)
  }

  /**
   * Setup automatic cleanup of closed window subscriptions
   */
  private setupWindowCleanup(): void {
    // This will be called when windows are closed
    const cleanup = () => {
      const validWindowIds = BrowserWindow.getAllWindows()
        .filter((w) => !w.isDestroyed())
        .map((w) => w.id)

      const subscribedWindowIds = Array.from(this.subscriptions.keys())
      const invalidWindowIds = subscribedWindowIds.filter((id) => !validWindowIds.includes(id))

      invalidWindowIds.forEach((id) => this.subscriptions.delete(id))

      if (invalidWindowIds.length > 0) {
        logger.debug(`Cleaned up ${invalidWindowIds.length} invalid window subscriptions`)
      }
    }

    // Run cleanup periodically (every 30 seconds)
    setInterval(cleanup, 30000)
  }

  /**
   * Get all preferences from memory cache
   * Returns complete preference object for bulk operations
   */
  public getAll(): PreferenceDefaultScopeType {
    if (!this.initialized) {
      logger.warn('Preference cache not initialized, returning defaults')
      return DefaultPreferences.default
    }

    return { ...this.cache }
  }

  /**
   * Get all current subscriptions (for debugging)
   */
  public getSubscriptions(): Map<number, Set<string>> {
    return new Map(this.subscriptions)
  }

  /**
   * Deep equality check for preference values
   * Handles primitives, arrays, and plain objects
   */
  private isEqual(a: any, b: any): boolean {
    // Handle strict equality (primitives, same reference)
    if (a === b) return true

    // Handle null/undefined
    if (a == null || b == null) return a === b

    // Handle different types
    if (typeof a !== typeof b) return false

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      return a.every((item, index) => this.isEqual(item, b[index]))
    }

    // Handle objects (plain objects only)
    if (typeof a === 'object' && typeof b === 'object') {
      // Check if both are plain objects
      if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) {
        return false
      }

      const keysA = Object.keys(a)
      const keysB = Object.keys(b)

      if (keysA.length !== keysB.length) return false

      return keysA.every((key) => keysB.includes(key) && this.isEqual(a[key], b[key]))
    }

    return false
  }

  /**
   * Register IPC handlers for preference operations
   * Provides communication interface between main and renderer processes
   */
  public static registerIpcHandler(): void {
    if (this.isIpcHandlerRegistered) return

    const instance = PreferenceService.getInstance()

    ipcMain.handle(IpcChannel.Preference_Get, (_, key: PreferenceKeyType) => {
      return instance.get(key)
    })

    ipcMain.handle(
      IpcChannel.Preference_Set,
      async (_, key: PreferenceKeyType, value: PreferenceDefaultScopeType[PreferenceKeyType]) => {
        await instance.set(key, value)
      }
    )

    ipcMain.handle(IpcChannel.Preference_GetMultiple, (_, keys: PreferenceKeyType[]) => {
      return instance.getMultiple(keys)
    })

    ipcMain.handle(IpcChannel.Preference_SetMultiple, async (_, updates: Partial<PreferenceDefaultScopeType>) => {
      await instance.setMultiple(updates)
    })

    ipcMain.handle(IpcChannel.Preference_GetAll, () => {
      return instance.getAll()
    })

    ipcMain.handle(IpcChannel.Preference_Subscribe, async (event, keys: string[]) => {
      const windowId = BrowserWindow.fromWebContents(event.sender)?.id
      if (windowId) {
        instance.subscribeForWindow(windowId, keys)
      }
    })

    this.isIpcHandlerRegistered = true
    logger.info('PreferenceService IPC handlers registered')
  }
}

// Export singleton instance
export const preferenceService = PreferenceService.getInstance()
