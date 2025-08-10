import dbService from '@data/db/DbService'
import { preferenceTable } from '@data/db/schemas/preference'
import { loggerService } from '@logger'
import { defaultPreferences } from '@shared/data/preferences'
import { and, eq } from 'drizzle-orm'

import { configManager } from '../../../../services/ConfigManager'
import { ELECTRON_STORE_MAPPINGS, REDUX_STORE_MAPPINGS } from './PreferencesMappings'

const logger = loggerService.withContext('PreferencesMigrator')

export interface MigrationItem {
  originalKey: string
  targetKey: string
  type: string
  defaultValue: any
  source: 'electronStore' | 'redux'
  sourceCategory?: string // Optional for electronStore
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
  private migrateService: any // Reference to DataRefactorMigrateService

  constructor(migrateService?: any) {
    this.migrateService = migrateService
  }

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
   * Load migration items from generated mapping relationships
   * This uses the auto-generated PreferencesMappings.ts file
   */
  private async loadMigrationItems(): Promise<MigrationItem[]> {
    logger.info('Loading migration items from generated mappings')
    const items: MigrationItem[] = []

    // Process ElectronStore mappings - no sourceCategory needed
    ELECTRON_STORE_MAPPINGS.forEach((mapping) => {
      const defaultValue = defaultPreferences.default[mapping.targetKey] ?? null
      items.push({
        originalKey: mapping.originalKey,
        targetKey: mapping.targetKey,
        type: 'unknown', // Type will be inferred from defaultValue during conversion
        defaultValue,
        source: 'electronStore'
      })
    })

    // Process Redux mappings
    Object.entries(REDUX_STORE_MAPPINGS).forEach(([category, mappings]) => {
      mappings.forEach((mapping) => {
        const defaultValue = defaultPreferences.default[mapping.targetKey] ?? null
        items.push({
          originalKey: mapping.originalKey, // May contain nested paths like "codeEditor.enabled"
          targetKey: mapping.targetKey,
          sourceCategory: category,
          type: 'unknown', // Type will be inferred from defaultValue during conversion
          defaultValue,
          source: 'redux'
        })
      })
    })

    logger.info('Successfully loaded migration items from generated mappings', {
      totalItems: items.length,
      electronStoreItems: items.filter((i) => i.source === 'electronStore').length,
      reduxItems: items.filter((i) => i.source === 'redux').length
    })

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
      if (!item.sourceCategory) {
        throw new Error(`Redux source requires sourceCategory for item: ${item.originalKey}`)
      }
      originalValue = await this.readFromReduxPersist(item.sourceCategory, item.originalKey)
    } else {
      throw new Error(`Unknown source: ${item.source}`)
    }

    // IMPORTANT: Only migrate if we actually found data, or if we want to set defaults
    // Skip migration if no original data found and no meaningful default
    let valueToMigrate = originalValue
    let shouldSkipMigration = false

    if (originalValue === undefined || originalValue === null) {
      // Check if we have a meaningful default value (not null)
      if (item.defaultValue !== null && item.defaultValue !== undefined) {
        valueToMigrate = item.defaultValue
        logger.info('Using default value for migration', {
          targetKey: item.targetKey,
          defaultValue: item.defaultValue,
          source: item.source,
          originalKey: item.originalKey
        })
      } else {
        // Skip migration if no data found and no meaningful default
        shouldSkipMigration = true
        logger.info('Skipping migration - no data found and no meaningful default', {
          targetKey: item.targetKey,
          originalValue,
          defaultValue: item.defaultValue,
          source: item.source,
          originalKey: item.originalKey
        })
      }
    } else {
      // Found original data, log the successful data retrieval
      logger.info('Found original data for migration', {
        targetKey: item.targetKey,
        source: item.source,
        originalKey: item.originalKey,
        valueType: typeof originalValue,
        valuePreview: JSON.stringify(originalValue).substring(0, 100)
      })
    }

    if (shouldSkipMigration) {
      return
    }

    // Convert value to appropriate type
    const convertedValue = this.convertValue(valueToMigrate, item.type)

    // Write to preferences table using Drizzle
    try {
      await this.writeToPreferences(item.targetKey, convertedValue)

      logger.info('Successfully migrated preference item', {
        targetKey: item.targetKey,
        source: item.source,
        originalKey: item.originalKey,
        originalValue,
        convertedValue,
        migrationSuccessful: true
      })
    } catch (writeError) {
      logger.error('Failed to write preference to database', {
        targetKey: item.targetKey,
        source: item.source,
        originalKey: item.originalKey,
        convertedValue,
        writeError
      })
      throw writeError
    }
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
   * Read value from Redux persist data with support for nested paths
   */
  private async readFromReduxPersist(category: string, key: string): Promise<any> {
    try {
      // Get cached Redux data from migrate service
      const reduxData = this.migrateService?.getReduxData()

      if (!reduxData) {
        logger.warn('No Redux persist data available in cache', { category, key })
        return undefined
      }

      logger.debug('Reading from cached Redux persist data', {
        category,
        key,
        availableCategories: Object.keys(reduxData),
        isNestedKey: key.includes('.')
      })

      // Get the category data from Redux persist cache
      const categoryData = reduxData[category]
      if (!categoryData) {
        logger.debug('Category not found in Redux persist data', {
          category,
          availableCategories: Object.keys(reduxData)
        })
        return undefined
      }

      // Redux persist usually stores data as JSON strings
      let parsedCategoryData
      try {
        parsedCategoryData = typeof categoryData === 'string' ? JSON.parse(categoryData) : categoryData
      } catch (parseError) {
        logger.warn('Failed to parse Redux persist category data', {
          category,
          categoryData: typeof categoryData,
          parseError
        })
        return undefined
      }

      // Handle nested paths (e.g., "codeEditor.enabled")
      let value
      if (key.includes('.')) {
        // Parse nested path
        const keyPath = key.split('.')
        let current = parsedCategoryData

        logger.debug('Parsing nested key path', {
          category,
          key,
          keyPath,
          rootDataKeys: current ? Object.keys(current) : []
        })

        for (const pathSegment of keyPath) {
          if (current && typeof current === 'object' && !Array.isArray(current)) {
            current = current[pathSegment]
            logger.debug('Navigated to path segment', {
              pathSegment,
              foundValue: current !== undefined,
              valueType: typeof current
            })
          } else {
            logger.debug('Failed to navigate nested path - invalid structure', {
              pathSegment,
              currentType: typeof current,
              isArray: Array.isArray(current)
            })
            return undefined
          }
        }
        value = current
      } else {
        // Direct field access (e.g., "theme")
        value = parsedCategoryData[key]
      }

      if (value !== undefined) {
        logger.debug('Successfully read from Redux persist cache', {
          category,
          key,
          value,
          valueType: typeof value,
          isNested: key.includes('.')
        })
      } else {
        logger.debug('Key not found in Redux persist data', {
          category,
          key,
          availableKeys: parsedCategoryData ? Object.keys(parsedCategoryData) : []
        })
      }

      return value
    } catch (error) {
      logger.warn('Failed to read from Redux persist cache', { category, key, error })
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
