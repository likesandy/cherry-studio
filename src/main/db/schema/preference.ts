import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { crudTimestamps } from './columnHelpers'

export const preferenceTable = sqliteTable(
  'preference',
  {
    scope: text().notNull(),
    key: text().notNull(),
    value: text({ mode: 'json' }),
    ...crudTimestamps
  },
  (t) => [index('scope_name_idx').on(t.scope, t.key)]
)
