import postgres from 'postgres'

declare global {
  // eslint-disable-next-line no-var
  var _pgSql: ReturnType<typeof postgres> | undefined
}

// Reuse the connection pool across Next.js hot-reloads in dev
const sql = globalThis._pgSql ?? postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

if (process.env.NODE_ENV !== 'production') {
  globalThis._pgSql = sql
}

export default sql
