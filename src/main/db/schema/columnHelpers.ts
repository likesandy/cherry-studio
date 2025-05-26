import { integer } from 'drizzle-orm/sqlite-core'

const createTimestamp = () => {
  return Date.now()
}

export const crudTimestamps = {
  createdAt: integer().$defaultFn(createTimestamp),
  updatedAt: integer().$defaultFn(createTimestamp).$onUpdateFn(createTimestamp),
  deletedAt: integer()
}
