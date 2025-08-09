import dbService from '@data/db/DbService'
import { appStateTable } from '@data/db/schemas/appState'
import { loggerService } from '@logger'
import { isDev } from '@main/constant'
import BackupManager from '@main/services/BackupManager'
import { IpcChannel } from '@shared/IpcChannel'
import { eq } from 'drizzle-orm'
import { app, BrowserWindow, ipcMain } from 'electron'
import { app as electronApp } from 'electron'
import { join } from 'path'

import { PreferencesMigrator } from './migrators/PreferencesMigrator'

const logger = loggerService.withContext('DataRefactorMigrateService')

const DATA_REFACTOR_MIGRATION_STATUS = 'data_refactor_migration_status'

// Data refactor migration status interface
interface DataRefactorMigrationStatus {
  completed: boolean
  completedAt?: number
  version?: string
}

interface MigrationProgress {
  stage: string
  progress: number
  total: number
  message: string
}

interface MigrationResult {
  success: boolean
  error?: string
  migratedCount: number
}

class DataRefactorMigrateService {
  private static instance: DataRefactorMigrateService | null = null
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

  /**
   * Register migration-specific IPC handlers
   * This creates an isolated IPC environment only for migration operations
   */
  public registerMigrationIpcHandlers(): void {
    logger.info('Registering migration-specific IPC handlers')

    // Only register the minimal IPC handlers needed for migration
    ipcMain.handle(IpcChannel.DataMigrate_CheckNeeded, async () => {
      try {
        return await this.isMigrated()
      } catch (error) {
        logger.error('IPC handler error: checkMigrationNeeded', error as Error)
        throw error
      }
    })

    ipcMain.handle(IpcChannel.DataMigrate_StartMigration, async () => {
      try {
        return await this.runMigration()
      } catch (error) {
        logger.error('IPC handler error: runMigration', error as Error)
        throw error
      }
    })

    ipcMain.handle(IpcChannel.DataMigrate_GetProgress, () => {
      try {
        return this.getCurrentProgress()
      } catch (error) {
        logger.error('IPC handler error: getCurrentProgress', error as Error)
        throw error
      }
    })

    ipcMain.handle(IpcChannel.DataMigrate_Cancel, async () => {
      try {
        return await this.cancelMigration()
      } catch (error) {
        logger.error('IPC handler error: cancelMigration', error as Error)
        throw error
      }
    })

    ipcMain.handle(IpcChannel.DataMigrate_BackupCompleted, () => {
      try {
        this.notifyBackupCompleted()
        return true
      } catch (error) {
        logger.error('IPC handler error: notifyBackupCompleted', error as Error)
        throw error
      }
    })

    ipcMain.handle(IpcChannel.DataMigrate_ShowBackupDialog, () => {
      try {
        // Show the backup dialog/interface
        // This could integrate with existing backup UI or create a new backup interface
        logger.info('Backup dialog request received')
        return true
      } catch (error) {
        logger.error('IPC handler error: showBackupDialog', error as Error)
        throw error
      }
    })

    logger.info('Migration IPC handlers registered successfully')
  }

  /**
   * Remove migration-specific IPC handlers
   * Clean up when migration is complete or cancelled
   */
  public unregisterMigrationIpcHandlers(): void {
    logger.info('Unregistering migration-specific IPC handlers')

    try {
      ipcMain.removeAllListeners(IpcChannel.DataMigrate_CheckNeeded)
      ipcMain.removeAllListeners(IpcChannel.DataMigrate_StartMigration)
      ipcMain.removeAllListeners(IpcChannel.DataMigrate_GetProgress)
      ipcMain.removeAllListeners(IpcChannel.DataMigrate_Cancel)
      ipcMain.removeAllListeners(IpcChannel.DataMigrate_BackupCompleted)
      ipcMain.removeAllListeners(IpcChannel.DataMigrate_ShowBackupDialog)

      logger.info('Migration IPC handlers unregistered successfully')
    } catch (error) {
      logger.warn('Error unregistering migration IPC handlers', error as Error)
    }
  }

  public static getInstance(): DataRefactorMigrateService {
    if (!DataRefactorMigrateService.instance) {
      DataRefactorMigrateService.instance = new DataRefactorMigrateService()
    }
    return DataRefactorMigrateService.instance
  }

  /**
   * Check if migration is needed
   */
  async isMigrated(): Promise<boolean> {
    try {
      const isMigrated = await this.isMigrationCompleted()
      if (isMigrated) {
        logger.info('Data Refactor Migration already completed')
        return true
      }

      return false
    } catch (error) {
      logger.error('Failed to check migration status', error as Error)
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
        .where(eq(appStateTable.key, DATA_REFACTOR_MIGRATION_STATUS))
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
          key: DATA_REFACTOR_MIGRATION_STATUS,
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

    // Register migration-specific IPC handlers before creating window
    this.registerMigrationIpcHandlers()

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
      }
    })

    // Load the migration window
    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      this.migrateWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/dataRefactorMigrate.html')
    } else {
      this.migrateWindow.loadFile(join(__dirname, '../renderer/dataRefactorMigrate.html'))
    }

    this.migrateWindow.once('ready-to-show', () => {
      this.migrateWindow?.show()
      if (!app.isPackaged) {
        this.migrateWindow?.webContents.openDevTools()
      }
    })

    this.migrateWindow.on('closed', () => {
      this.migrateWindow = null
      // Clean up IPC handlers when window is closed
      this.unregisterMigrationIpcHandlers()
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

      await this.updateProgress('completed', 100, 'Migration completed! App will restart in 3 seconds...')

      // Wait a moment to show success message, then restart the app
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          logger.info('Migration completed successfully, restarting application')
          this.restartApplication()
          resolve()
        }, 3000)
      })
    } catch (error) {
      logger.error('Migration flow failed', error as Error)
      await this.updateProgress(
        'error',
        0,
        `Migration failed: ${error instanceof Error ? error.message : String(error)}. Please restart the app to try again.`
      )

      // Wait a moment to show error message, then close migration window
      // Do NOT restart on error - let user handle the situation
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          this.closeMigrateWindow()
          resolve()
        }, 8000) // Show error for longer (8 seconds) to give user time to read
      })

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

    // Clean up migration-specific IPC handlers
    this.unregisterMigrationIpcHandlers()
  }

  /**
   * Restart the application after successful migration
   */
  private restartApplication(): void {
    try {
      logger.info('Restarting application after migration completion')

      // Clean up migration window and handlers before restart
      this.closeMigrateWindow()

      // Restart the app using Electron's relaunch mechanism
      app.relaunch()
      app.exit(0)
    } catch (error) {
      logger.error('Failed to restart application', error as Error)
      // Fallback: just close migration window and let user manually restart
      this.closeMigrateWindow()
    }
  }
}

// Export singleton instance
export const dataRefactorMigrateService = DataRefactorMigrateService.getInstance()
