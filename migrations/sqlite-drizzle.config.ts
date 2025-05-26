import { defineConfig } from 'drizzle-kit'
export default defineConfig({
  out: './migrations/sqlite-drizzle',
  schema: './src/main/db/schema/*',
  dialect: 'sqlite',
  casing: 'snake_case'
})
