import dbService from '@data/db/DbService'
import { APP_STATE_KEYS, appStateTable, DataRefactorMigrationStatus } from '@data/db/schemas/appState'
import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { eq } from 'drizzle-orm'
import { app, BrowserWindow } from 'electron'
import { app as electronApp } from 'electron'
import fs from 'fs-extra'
import { join } from 'path'

import icon from '../../../../build/icon.png?asset'
import BackupManager from '../../services/BackupManager'
import { PreferencesMigrator } from './PreferencesMigrator'

const logger = loggerService.withContext('MigrateService')

export interface MigrationProgress {
  stage: string
  progress: number
  total: number
  message: string
}

export interface MigrationResult {
  success: boolean
  error?: string
  migratedCount: number
}

export class MigrateService {
  private static instance: MigrateService | null = null
  private migrateWindow: BrowserWindow | null = null
  private backupManager: BackupManager
  private backupCompletionResolver: ((value: boolean) => void) | null = null
  private backupTimeout: NodeJS.Timeout | null = null
  private db = dbService.getDb()
  private currentProgress: MigrationProgress = {
    stage: 'idle',
    progress: 0,
    total: 100,
    message: 'Ready to migrate'
  }
  private isMigrating: boolean = false

  constructor() {
    this.backupManager = new BackupManager()
  }

  /**
   * Get backup manager instance for integration with existing backup system
   */
  public getBackupManager(): BackupManager {
    return this.backupManager
  }

  public static getInstance(): MigrateService {
    if (!MigrateService.instance) {
      MigrateService.instance = new MigrateService()
    }
    return MigrateService.instance
  }

  /**
   * Check if migration is needed
   */
  async checkMigrationNeeded(): Promise<boolean> {
    try {
      logger.info('Checking if migration is needed')

      // 1. Check migration completion status
      const isMigrated = await this.isMigrationCompleted()
      if (isMigrated) {
        logger.info('Migration already completed')
        return false
      }

      // 2. Check if there's old data that needs migration
      const hasOldData = await this.hasOldFormatData()

      logger.info('Migration check result', {
        isMigrated,
        hasOldData
      })

      return hasOldData
    } catch (error) {
      logger.error('Failed to check migration status', error as Error)
      return false
    }
  }

  /**
   * Check if old format data exists
   */
  private async hasOldFormatData(): Promise<boolean> {
    const hasReduxData = await this.checkReduxPersistData()
    const hasElectronStoreData = await this.checkElectronStoreData()

    logger.debug('Old format data check', {
      hasReduxData,
      hasElectronStoreData
    })

    return hasReduxData || hasElectronStoreData
  }

  /**
   * Check if Redux persist data exists
   */
  private async checkReduxPersistData(): Promise<boolean> {
    try {
      // In Electron, localStorage data is stored in userData/Local Storage/leveldb
      // We'll check for the existence of these files as a proxy for Redux persist data
      const userDataPath = app.getPath('userData')
      const localStoragePath = join(userDataPath, 'Local Storage', 'leveldb')

      const exists = await fs.pathExists(localStoragePath)
      logger.debug('Redux persist data check', { localStoragePath, exists })

      return exists
    } catch (error) {
      logger.warn('Failed to check Redux persist data', error as Error)
      return false
    }
  }

  /**
   * Check if ElectronStore data exists
   */
  private async checkElectronStoreData(): Promise<boolean> {
    try {
      // ElectronStore typically stores data in config files
      const userDataPath = app.getPath('userData')
      const configPath = join(userDataPath, 'config.json')

      const exists = await fs.pathExists(configPath)
      logger.debug('ElectronStore data check', { configPath, exists })

      return exists
    } catch (error) {
      logger.warn('Failed to check ElectronStore data', error as Error)
      return false
    }
  }

  /**
   * Check if migration is already completed
   */
  private async isMigrationCompleted(): Promise<boolean> {
    try {
      const result = await this.db
        .select()
        .from(appStateTable)
        .where(eq(appStateTable.key, APP_STATE_KEYS.DATA_REFACTOR_MIGRATION_STATUS))
        .limit(1)

      if (result.length === 0) return false

      const status = result[0].value as DataRefactorMigrationStatus
      return status.completed === true
    } catch (error) {
      logger.warn('Failed to check migration state', error as Error)
      return false
    }
  }

  /**
   * Mark migration as completed
   */
  private async markMigrationCompleted(): Promise<void> {
    try {
      const migrationStatus: DataRefactorMigrationStatus = {
        completed: true,
        completedAt: Date.now(),
        version: electronApp.getVersion()
      }

      await this.db
        .insert(appStateTable)
        .values({
          key: APP_STATE_KEYS.DATA_REFACTOR_MIGRATION_STATUS,
          value: migrationStatus, // drizzle handles JSON serialization automatically
          description: 'Data refactoring migration status from legacy format (ElectronStore + Redux persist) to SQLite',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        .onConflictDoUpdate({
          target: appStateTable.key,
          set: {
            value: migrationStatus,
            updatedAt: Date.now()
          }
        })

      logger.info('Migration marked as completed in app_state table', {
        version: migrationStatus.version,
        completedAt: migrationStatus.completedAt
      })
    } catch (error) {
      logger.error('Failed to mark migration as completed', error as Error)
      throw error
    }
  }

  /**
   * Create and show migration window
   */
  private createMigrateWindow(): BrowserWindow {
    if (this.migrateWindow && !this.migrateWindow.isDestroyed()) {
      this.migrateWindow.show()
      return this.migrateWindow
    }

    this.migrateWindow = new BrowserWindow({
      width: 600,
      height: 500,
      resizable: false,
      maximizable: false,
      minimizable: false,
      show: false,
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        webSecurity: false,
        contextIsolation: true
      },
      ...(process.platform === 'linux' ? { icon } : {})
    })

    // Load the migration window
    if (app.isPackaged) {
      this.migrateWindow.loadFile(join(__dirname, '../renderer/dataMigrate.html'))
    } else {
      this.migrateWindow.loadURL('http://localhost:5173/dataMigrate.html')
    }

    this.migrateWindow.once('ready-to-show', () => {
      this.migrateWindow?.show()
      if (!app.isPackaged) {
        this.migrateWindow?.webContents.openDevTools()
      }
    })

    this.migrateWindow.on('closed', () => {
      this.migrateWindow = null
    })

    logger.info('Migration window created')
    return this.migrateWindow
  }

  /**
   * Run the complete migration process
   */
  async runMigration(): Promise<void> {
    if (this.isMigrating) {
      logger.warn('Migration already in progress')
      return
    }

    try {
      this.isMigrating = true
      logger.info('Starting migration process')

      // Create migration window
      const window = this.createMigrateWindow()

      // Wait for window to be ready
      await new Promise<void>((resolve) => {
        if (window.webContents.isLoading()) {
          window.webContents.once('did-finish-load', () => resolve())
        } else {
          resolve()
        }
      })

      // Start the migration flow
      await this.executeMigrationFlow()
    } catch (error) {
      logger.error('Migration process failed', error as Error)
      throw error
    } finally {
      this.isMigrating = false
    }
  }

  /**
   * Execute the complete migration flow
   */
  private async executeMigrationFlow(): Promise<void> {
    try {
      // Step 1: Enforce backup
      await this.updateProgress('backup', 0, 'Starting backup process...')
      const backupSuccess = await this.enforceBackup()

      if (!backupSuccess) {
        throw new Error('Backup process failed or was cancelled by user')
      }

      await this.updateProgress('backup', 100, 'Backup completed successfully')

      // Step 2: Execute migration
      await this.updateProgress('migration', 0, 'Starting data migration...')
      const migrationResult = await this.executeMigration()

      if (!migrationResult.success) {
        throw new Error(migrationResult.error || 'Migration failed')
      }

      await this.updateProgress(
        'migration',
        100,
        `Migration completed: ${migrationResult.migratedCount} items migrated`
      )

      // Step 3: Mark as completed
      await this.markMigrationCompleted()

      await this.updateProgress('completed', 100, 'Migration process completed successfully')

      // Close migration window after a delay
      setTimeout(() => {
        this.closeMigrateWindow()
      }, 3000)
    } catch (error) {
      logger.error('Migration flow failed', error as Error)
      await this.updateProgress(
        'error',
        0,
        `Migration failed: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }

  /**
   * Enforce backup before migration
   */
  private async enforceBackup(): Promise<boolean> {
    try {
      logger.info('Enforcing backup before migration')

      await this.updateProgress('backup', 0, 'Backup is required before migration')

      // Send backup requirement to renderer
      if (this.migrateWindow && !this.migrateWindow.isDestroyed()) {
        this.migrateWindow.webContents.send(IpcChannel.DataMigrate_RequireBackup)
      }

      // Wait for user to complete backup
      const backupResult = await this.waitForBackupCompletion()

      if (backupResult) {
        await this.updateProgress('backup', 100, 'Backup completed successfully')
        return true
      } else {
        await this.updateProgress('backup', 0, 'Backup is required to proceed with migration')
        return false
      }
    } catch (error) {
      logger.error('Backup enforcement failed', error as Error)
      await this.updateProgress('backup', 0, 'Backup process failed')
      return false
    }
  }

  /**
   * Wait for user to complete backup
   */
  private async waitForBackupCompletion(): Promise<boolean> {
    return new Promise((resolve) => {
      // Store resolver for later use
      this.backupCompletionResolver = resolve

      // Set up timeout (5 minutes)
      this.backupTimeout = setTimeout(() => {
        logger.warn('Backup completion timeout')
        this.backupCompletionResolver = null
        this.backupTimeout = null
        resolve(false)
      }, 300000) // 5 minutes

      // The actual completion will be triggered by notifyBackupCompleted() method
    })
  }

  /**
   * Notify that backup has been completed (called from IPC handler)
   */
  public notifyBackupCompleted(): void {
    if (this.backupCompletionResolver) {
      logger.info('Backup completed by user')

      // Clear timeout if it exists
      if (this.backupTimeout) {
        clearTimeout(this.backupTimeout)
        this.backupTimeout = null
      }

      this.backupCompletionResolver(true)
      this.backupCompletionResolver = null
    }
  }

  /**
   * Execute the actual migration
   */
  private async executeMigration(): Promise<MigrationResult> {
    try {
      logger.info('Executing migration')

      // Create preferences migrator
      const preferencesMigrator = new PreferencesMigrator()

      // Execute preferences migration with progress updates
      const result = await preferencesMigrator.migrate((progress, message) => {
        this.updateProgress('migration', progress, message)
      })

      logger.info('Migration execution completed', result)

      return {
        success: result.success,
        migratedCount: result.migratedCount,
        error: result.errors.length > 0 ? result.errors.map((e) => e.error).join('; ') : undefined
      }
    } catch (error) {
      logger.error('Migration execution failed', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        migratedCount: 0
      }
    }
  }

  /**
   * Update migration progress and broadcast to window
   */
  private async updateProgress(stage: string, progress: number, message: string): Promise<void> {
    this.currentProgress = {
      stage,
      progress,
      total: 100,
      message
    }

    if (this.migrateWindow && !this.migrateWindow.isDestroyed()) {
      this.migrateWindow.webContents.send(IpcChannel.DataMigrateProgress, this.currentProgress)
    }

    logger.debug('Progress updated', this.currentProgress)
  }

  /**
   * Get current migration progress
   */
  getCurrentProgress(): MigrationProgress {
    return this.currentProgress
  }

  /**
   * Cancel migration process
   */
  async cancelMigration(): Promise<void> {
    if (!this.isMigrating) {
      return
    }

    logger.info('Cancelling migration process')
    this.isMigrating = false
    await this.updateProgress('cancelled', 0, 'Migration cancelled by user')
    this.closeMigrateWindow()
  }

  /**
   * Close migration window
   */
  private closeMigrateWindow(): void {
    if (this.migrateWindow && !this.migrateWindow.isDestroyed()) {
      this.migrateWindow.close()
      this.migrateWindow = null
    }
  }
}

// Export singleton instance
export const migrateService = MigrateService.getInstance()
