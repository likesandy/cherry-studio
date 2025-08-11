import { loggerService } from '@logger'
import type { PreferencesType } from '@shared/data/preferences'
import { DefaultPreferences } from '@shared/data/preferences'
import { IpcChannel } from '@shared/IpcChannel'
import { and, eq } from 'drizzle-orm'
import { BrowserWindow } from 'electron'

import dbService from './db/DbService'
import { preferenceTable } from './db/schemas/preference'

const logger = loggerService.withContext('PreferenceService')

type PreferenceKey = keyof PreferencesType['default']

/**
 * PreferenceService manages preference data storage and synchronization across multiple windows
 *
 * Features:
 * - Memory-cached preferences for high performance
 * - SQLite database persistence using Drizzle ORM
 * - Multi-window subscription and synchronization
 * - Type-safe preference operations
 * - Batch operations support
 * - Change notification broadcasting
 */
export class PreferenceService {
  private static instance: PreferenceService
  private subscriptions = new Map<number, Set<string>>() // windowId -> Set<keys>
  private cache: Record<string, any> = { ...DefaultPreferences.default }
  private initialized = false

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
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      const db = dbService.getDb()
      const results = await db.select().from(preferenceTable).where(eq(preferenceTable.scope, 'default'))

      // Update cache with database values, keeping defaults for missing keys
      for (const result of results) {
        const key = result.key as PreferenceKey
        if (key in this.cache) {
          this.cache[key] = result.value as any
        }
      }

      this.initialized = true
      logger.info(`Preference cache initialized with ${results.length} values`)
    } catch (error) {
      logger.error('Failed to initialize preference cache:', error as Error)
      // Keep default values on initialization failure
      this.initialized = true
    }
  }

  /**
   * Get a single preference value from memory cache
   * Fast synchronous access - no database queries after initialization
   */
  get<K extends PreferenceKey>(key: K): PreferencesType['default'][K] {
    if (!this.initialized) {
      logger.warn(`Preference cache not initialized, returning default for ${key}`)
      return DefaultPreferences.default[key]
    }

    return this.cache[key] ?? DefaultPreferences.default[key]
  }

  /**
   * Set a single preference value
   * Updates both database and memory cache, then broadcasts changes to subscribed windows
   */
  async set<K extends PreferenceKey>(key: K, value: PreferencesType['default'][K]): Promise<void> {
    try {
      const db = dbService.getDb()
      const scope = 'default'

      // First try to update existing record
      const existing = await db
        .select()
        .from(preferenceTable)
        .where(and(eq(preferenceTable.scope, scope), eq(preferenceTable.key, key)))
        .limit(1)

      if (existing.length > 0) {
        // Update existing record
        await db
          .update(preferenceTable)
          .set({
            value: value as any
          })
          .where(and(eq(preferenceTable.scope, scope), eq(preferenceTable.key, key)))
      } else {
        // Insert new record
        await db.insert(preferenceTable).values({
          scope,
          key,
          value: value as any
        })
      }

      // Update memory cache immediately
      this.cache[key] = value

      // Broadcast change to subscribed windows
      await this.notifyChange(key, value)

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
  getMultiple(keys: string[]): Record<string, any> {
    if (!this.initialized) {
      logger.warn('Preference cache not initialized, returning defaults for multiple keys')
      const output: Record<string, any> = {}
      for (const key of keys) {
        if (key in DefaultPreferences.default) {
          output[key] = DefaultPreferences.default[key as PreferenceKey]
        } else {
          output[key] = undefined
        }
      }
      return output
    }

    const output: Record<string, any> = {}
    for (const key of keys) {
      if (key in this.cache) {
        output[key] = this.cache[key as PreferenceKey]
      } else {
        output[key] = undefined
      }
    }

    return output
  }

  /**
   * Set multiple preferences at once
   * Updates both database and memory cache in a transaction, then broadcasts changes
   */
  async setMultiple(updates: Record<string, any>): Promise<void> {
    try {
      const scope = 'default'

      await dbService.transaction(async (tx) => {
        for (const [key, value] of Object.entries(updates)) {
          // Check if record exists
          const existing = await tx
            .select()
            .from(preferenceTable)
            .where(and(eq(preferenceTable.scope, scope), eq(preferenceTable.key, key)))
            .limit(1)

          if (existing.length > 0) {
            // Update existing record
            await tx
              .update(preferenceTable)
              .set({
                value
              })
              .where(and(eq(preferenceTable.scope, scope), eq(preferenceTable.key, key)))
          } else {
            // Insert new record
            await tx.insert(preferenceTable).values({
              scope,
              key,
              value
            })
          }
        }
      })

      // Update memory cache for all changed keys
      for (const [key, value] of Object.entries(updates)) {
        if (key in this.cache) {
          this.cache[key as PreferenceKey] = value
        }
      }

      // Broadcast all changes
      const changePromises = Object.entries(updates).map(([key, value]) => this.notifyChange(key, value))
      await Promise.all(changePromises)

      logger.debug(`Updated ${Object.keys(updates).length} preferences successfully`)
    } catch (error) {
      logger.error('Failed to set multiple preferences:', error as Error)
      throw error
    }
  }

  /**
   * Subscribe a window to preference changes
   * Window will receive notifications for specified keys
   */
  subscribe(windowId: number, keys: string[]): void {
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
  unsubscribe(windowId: number): void {
    this.subscriptions.delete(windowId)
    logger.debug(`Window ${windowId} unsubscribed from preference changes`)
  }

  /**
   * Broadcast preference change to all subscribed windows
   */
  private async notifyChange(key: string, value: any): Promise<void> {
    const affectedWindows: number[] = []

    for (const [windowId, subscribedKeys] of this.subscriptions.entries()) {
      if (subscribedKeys.has(key)) {
        affectedWindows.push(windowId)
      }
    }

    if (affectedWindows.length === 0) {
      return
    }

    // Send to all affected windows
    for (const windowId of affectedWindows) {
      try {
        const window = BrowserWindow.fromId(windowId)
        if (window && !window.isDestroyed()) {
          window.webContents.send(IpcChannel.Preference_Changed, key, value, 'default')
        } else {
          // Clean up invalid window subscription
          this.subscriptions.delete(windowId)
        }
      } catch (error) {
        logger.error(`Failed to notify window ${windowId}:`, error as Error)
        this.subscriptions.delete(windowId)
      }
    }

    logger.debug(`Broadcasted preference change ${key} to ${affectedWindows.length} windows`)
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
   * Get all current subscriptions (for debugging)
   */
  getSubscriptions(): Map<number, Set<string>> {
    return new Map(this.subscriptions)
  }
}

// Export singleton instance
export const preferenceService = PreferenceService.getInstance()
export default preferenceService
