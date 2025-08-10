import { loggerService } from '@logger'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { app } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'

import Seeding from './seeding'
import type { DbType } from './types'

const logger = loggerService.withContext('DbService')

const DB_NAME = 'cherrystudio.sqlite'
const MIGRATIONS_BASE_PATH = 'migrations/sqlite-drizzle'

class DbService {
  private static instance: DbService
  private db: DbType

  private constructor() {
    this.db = drizzle({
      connection: { url: pathToFileURL(path.join(app.getPath('userData'), DB_NAME)).href },
      casing: 'snake_case'
    })
  }

  public static getInstance(): DbService {
    if (!DbService.instance) {
      DbService.instance = new DbService()
    }
    return DbService.instance
  }

  public async migrateDb() {
    const migrationsFolder = this.getMigrationsFolder()
    await migrate(this.db, { migrationsFolder })
  }

  public getDb(): DbType {
    return this.db
  }

  /**
   * Execute operations within a database transaction
   * Automatically handles rollback on error and commit on success
   */
  public async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    logger.debug('Starting database transaction')

    try {
      const result = await this.db.transaction(async (tx) => {
        return await callback(tx)
      })

      logger.debug('Database transaction completed successfully')
      return result
    } catch (error) {
      logger.error('Database transaction failed, rolling back', error as Error)
      throw error
    }
  }

  public async migrateSeed(seedName: keyof typeof Seeding): Promise<boolean> {
    try {
      const Seed = Seeding[seedName]
      await new Seed().migrate(this.db)
      return true
    } catch (error) {
      logger.error('migration seeding failed', error as Error)
      return false
    }
  }

  /**
   * Get the migrations folder based on the app's packaging status
   * @returns The path to the migrations folder
   */
  private getMigrationsFolder() {
    if (app.isPackaged) {
      //see electron-builder.yml, extraResources from/to
      return path.join(process.resourcesPath, MIGRATIONS_BASE_PATH)
    } else {
      // in dev/preview, __dirname maybe /out/main
      return path.join(__dirname, '../../', MIGRATIONS_BASE_PATH)
    }
  }
}

// Export a singleton instance
const dbService = DbService.getInstance()

export default dbService
