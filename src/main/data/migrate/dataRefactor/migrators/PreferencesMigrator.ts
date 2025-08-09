import dbService from '@data/db/DbService'
import { preferenceTable } from '@data/db/schemas/preference'
import { loggerService } from '@logger'
import { and, eq } from 'drizzle-orm'

import { configManager } from '../../../../services/ConfigManager'

const logger = loggerService.withContext('PreferencesMigrator')

export interface MigrationItem {
  originalKey: string
  targetKey: string
  type: string
  defaultValue: any
  source: 'electronStore' | 'redux'
  sourceCategory: string
}

export interface MigrationResult {
  success: boolean
  migratedCount: number
  errors: Array<{
    key: string
    error: string
  }>
}

export class PreferencesMigrator {
  private db = dbService.getDb()

  /**
   * Execute preferences migration from all sources
   */
  async migrate(onProgress?: (progress: number, message: string) => void): Promise<MigrationResult> {
    logger.info('Starting preferences migration')

    const result: MigrationResult = {
      success: true,
      migratedCount: 0,
      errors: []
    }

    try {
      // Get migration items from classification.json
      const migrationItems = await this.loadMigrationItems()
      const totalItems = migrationItems.length

      logger.info(`Found ${totalItems} items to migrate`)

      for (let i = 0; i < migrationItems.length; i++) {
        const item = migrationItems[i]

        try {
          await this.migrateItem(item)
          result.migratedCount++

          const progress = Math.floor(((i + 1) / totalItems) * 100)
          onProgress?.(progress, `Migrated: ${item.targetKey}`)
        } catch (error) {
          logger.error('Failed to migrate item', { item, error })
          result.errors.push({
            key: item.originalKey,
            error: error instanceof Error ? error.message : String(error)
          })
          result.success = false
        }
      }

      logger.info('Preferences migration completed', {
        migratedCount: result.migratedCount,
        errorCount: result.errors.length
      })
    } catch (error) {
      logger.error('Preferences migration failed', error as Error)
      result.success = false
      result.errors.push({
        key: 'global',
        error: error instanceof Error ? error.message : String(error)
      })
    }

    return result
  }

  /**
   * Load migration items from the generated preferences.ts mappings
   * For now, we'll use a simplified set based on the current generated migration code
   */
  private async loadMigrationItems(): Promise<MigrationItem[]> {
    // This is a simplified implementation. In the full version, this would read from
    // the classification.json and apply the same deduplication logic as the generators

    const items: MigrationItem[] = [
      // ElectronStore items (from generated migration code)
      {
        originalKey: 'Language',
        targetKey: 'app.language',
        sourceCategory: 'Language',
        type: 'unknown',
        defaultValue: null,
        source: 'electronStore'
      },
      {
        originalKey: 'SelectionAssistantFollowToolbar',
        targetKey: 'feature.selection.follow_toolbar',
        sourceCategory: 'SelectionAssistantFollowToolbar',
        type: 'unknown',
        defaultValue: null,
        source: 'electronStore'
      },
      {
        originalKey: 'SelectionAssistantRemeberWinSize',
        targetKey: 'feature.selection.remember_win_size',
        sourceCategory: 'SelectionAssistantRemeberWinSize',
        type: 'unknown',
        defaultValue: null,
        source: 'electronStore'
      },
      {
        originalKey: 'ZoomFactor',
        targetKey: 'app.zoom_factor',
        sourceCategory: 'ZoomFactor',
        type: 'unknown',
        defaultValue: null,
        source: 'electronStore'
      }
    ]

    // Add some sample Redux items (in full implementation, these would be loaded from classification.json)
    const reduxItems: MigrationItem[] = [
      {
        originalKey: 'theme',
        targetKey: 'app.theme.mode',
        sourceCategory: 'settings',
        type: 'string',
        defaultValue: 'ThemeMode.system',
        source: 'redux'
      },
      {
        originalKey: 'language',
        targetKey: 'app.language',
        sourceCategory: 'settings',
        type: 'string',
        defaultValue: 'en',
        source: 'redux'
      }
    ]

    items.push(...reduxItems)

    return items
  }

  /**
   * Migrate a single preference item
   */
  private async migrateItem(item: MigrationItem): Promise<void> {
    logger.debug('Migrating preference item', { item })

    let originalValue: any

    // Read value from the appropriate source
    if (item.source === 'electronStore') {
      originalValue = await this.readFromElectronStore(item.originalKey)
    } else if (item.source === 'redux') {
      originalValue = await this.readFromReduxPersist(item.sourceCategory, item.originalKey)
    } else {
      throw new Error(`Unknown source: ${item.source}`)
    }

    // Use default value if original value is not found
    let valueToMigrate = originalValue
    if (originalValue === undefined || originalValue === null) {
      valueToMigrate = item.defaultValue
    }

    // Convert value to appropriate type
    const convertedValue = this.convertValue(valueToMigrate, item.type)

    // Write to preferences table using Drizzle
    await this.writeToPreferences(item.targetKey, convertedValue)

    logger.debug('Successfully migrated preference item', {
      targetKey: item.targetKey,
      originalValue,
      convertedValue
    })
  }

  /**
   * Read value from ElectronStore (via ConfigManager)
   */
  private async readFromElectronStore(key: string): Promise<any> {
    try {
      return configManager.get(key)
    } catch (error) {
      logger.warn('Failed to read from ElectronStore', { key, error })
      return undefined
    }
  }

  /**
   * Read value from Redux persist data
   */
  private async readFromReduxPersist(category: string, key: string): Promise<any> {
    try {
      // This is a simplified implementation
      // In the full version, we would need to properly parse the leveldb files
      // For now, we'll return undefined to use default values

      logger.debug('Redux persist read not fully implemented', { category, key })
      return undefined
    } catch (error) {
      logger.warn('Failed to read from Redux persist', { category, key, error })
      return undefined
    }
  }

  /**
   * Convert value to the specified type
   */
  private convertValue(value: any, targetType: string): any {
    if (value === null || value === undefined) {
      return null
    }

    try {
      switch (targetType) {
        case 'boolean':
          return this.toBoolean(value)
        case 'string':
          return this.toString(value)
        case 'number':
          return this.toNumber(value)
        case 'array':
        case 'unknown[]':
          return this.toArray(value)
        case 'object':
        case 'Record<string, unknown>':
          return this.toObject(value)
        default:
          return value
      }
    } catch (error) {
      logger.warn('Type conversion failed, using original value', { value, targetType, error })
      return value
    }
  }

  private toBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      return lower === 'true' || lower === '1' || lower === 'yes'
    }
    if (typeof value === 'number') return value !== 0
    return Boolean(value)
  }

  private toString(value: any): string {
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  private toNumber(value: any): number {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const parsed = parseFloat(value)
      return isNaN(parsed) ? 0 : parsed
    }
    if (typeof value === 'boolean') return value ? 1 : 0
    return 0
  }

  private toArray(value: any): any[] {
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : [value]
      } catch {
        return [value]
      }
    }
    return [value]
  }

  private toObject(value: any): Record<string, any> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : { value }
      } catch {
        return { value }
      }
    }
    return { value }
  }

  /**
   * Write value to preferences table using direct Drizzle operations
   */
  private async writeToPreferences(targetKey: string, value: any): Promise<void> {
    const scope = 'default'

    try {
      // Check if preference already exists
      const existing = await this.db
        .select()
        .from(preferenceTable)
        .where(and(eq(preferenceTable.scope, scope), eq(preferenceTable.key, targetKey)))
        .limit(1)

      if (existing.length > 0) {
        // Update existing preference
        await this.db
          .update(preferenceTable)
          .set({
            value: value, // drizzle handles JSON serialization automatically
            updatedAt: Date.now()
          })
          .where(and(eq(preferenceTable.scope, scope), eq(preferenceTable.key, targetKey)))
      } else {
        // Insert new preference
        await this.db.insert(preferenceTable).values({
          scope,
          key: targetKey,
          value: value, // drizzle handles JSON serialization automatically
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
      }

      logger.debug('Successfully wrote to preferences table', { targetKey, value })
    } catch (error) {
      logger.error('Failed to write to preferences table', { targetKey, value, error })
      throw error
    }
  }
}
