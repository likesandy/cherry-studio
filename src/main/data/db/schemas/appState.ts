import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { crudTimestamps } from './columnHelpers'

export const appStateTable = sqliteTable('app_state', {
  key: text().primaryKey(),
  value: text({ mode: 'json' }).notNull(), // JSON field, drizzle handles serialization automatically
  description: text(), // Optional description field
  ...crudTimestamps
})

export type AppStateTable = typeof appStateTable
export type AppStateInsert = typeof appStateTable.$inferInsert
export type AppStateSelect = typeof appStateTable.$inferSelect

// State key constants
export const APP_STATE_KEYS = {
  DATA_REFACTOR_MIGRATION_STATUS: 'data_refactor_migration_status',
  // Future state keys can be added here
  // FIRST_RUN_COMPLETED: 'first_run_completed',
  // USER_ONBOARDING_COMPLETED: 'user_onboarding_completed',
} as const

// Data refactor migration status interface
export interface DataRefactorMigrationStatus {
  completed: boolean
  completedAt?: number
  version?: string
}