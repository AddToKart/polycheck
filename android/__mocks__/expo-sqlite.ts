// Mock expo-sqlite for Jest
type Row = Record<string, unknown>

class MockSQLiteDatabase {
  private tables: Record<string, Row[]> = {}
  private nextId = 1

  clear() {
    this.tables = {}
  }

  async execAsync(sql: string) {
    // Parse CREATE TABLE IF NOT EXISTS statements
    const createMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/g)
    if (createMatch) {
      for (const match of createMatch) {
        const tableName = match.replace(/CREATE TABLE IF NOT EXISTS\s+/, '')
        if (!this.tables[tableName]) this.tables[tableName] = []
      }
    }
  }

  async runAsync(sql: string, ...params: unknown[]) {
    // Simple INSERT OR IGNORE / UPDATE / DELETE handling
    const insertMatch = sql.match(/INSERT (?:OR IGNORE )?INTO (\w+)/i)
    if (insertMatch) {
      const table = insertMatch[1]
      if (!this.tables[table]) this.tables[table] = []
      // Extract column names from the INSERT statement
      const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/)
      if (colMatch) {
        const cols = colMatch[1].split(',').map((c) => c.trim())
        const row: Row = {}
        cols.forEach((col, i) => {
          row[col] = params[i] !== undefined ? params[i] : null
        })
        // Check for ON CONFLICT DO UPDATE
        if (sql.includes('ON CONFLICT')) {
          const pkCol = cols[0]
          const existing = this.tables[table].find((r) => r[pkCol] === row[pkCol])
          if (existing) {
            Object.assign(existing, row)
          } else {
            this.tables[table].push(row)
          }
        } else {
          this.tables[table].push(row)
        }
      }
      return { changes: 1 }
    }

    const updateMatch = sql.match(/UPDATE (\w+)/i)
    if (updateMatch) {
      const table = updateMatch[1]
      if (!this.tables[table]) return { changes: 0 }
      // Simple update: set last row matching WHERE
      const whereMatch = sql.match(/WHERE (\w+)\s*=\s*\?/)
      if (whereMatch) {
        const whereCol = whereMatch[1]
        const whereVal = params[params.length - 1]
        const row = this.tables[table].find((r) => r[whereCol] === whereVal)
        if (row) {
          // Parse SET clauses
          const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i)
          if (setMatch) {
            const setParts = setMatch[1].split(',').map((s) => s.trim())
            let paramIdx = 0
            for (const part of setParts) {
              const [col] = part.split('=').map((c) => c.trim())
              row[col] = params[paramIdx]
              paramIdx++
            }
          }
          return { changes: 1 }
        }
      }
      return { changes: 0 }
    }

    const deleteMatch = sql.match(/DELETE FROM (\w+)/i)
    if (deleteMatch) {
      const table = deleteMatch[1]
      if (!this.tables[table]) return { changes: 0 }
      const whereMatch = sql.match(/WHERE (\w+)\s*=\s*\?/)
      if (whereMatch) {
        const whereCol = whereMatch[1]
        const whereVal = params[0]
        const before = this.tables[table].length
        this.tables[table] = this.tables[table].filter((r) => r[whereCol] !== whereVal)
        return { changes: before - this.tables[table].length }
      }
    }

    return { changes: 0 }
  }

  async getAllAsync<T = Row>(sql: string, ...params: unknown[]): Promise<T[]> {
    const selectMatch = sql.match(/FROM (\w+)/i)
    if (!selectMatch) return []
    const table = selectMatch[1]
    if (!this.tables[table]) return []

    let rows = [...this.tables[table]]

    // WHERE clause
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/)
    if (whereMatch) {
      const col = whereMatch[1]
      const val = params[0]
      rows = rows.filter((r) => r[col] === val)
    }

    // ORDER BY
    const orderMatch = sql.match(/ORDER BY (\w+)(?:\s+(ASC|DESC))?/)
    if (orderMatch) {
      const col = orderMatch[1]
      const dir = (orderMatch[2] || 'ASC') as 'ASC' | 'DESC'
      rows.sort((a, b) => {
        const left = String(a[col] ?? '')
        const right = String(b[col] ?? '')
        if (left < right) return dir === 'ASC' ? -1 : 1
        if (left > right) return dir === 'ASC' ? 1 : -1
        return 0
      })
    }

    // LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/)
    if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1]))

    return rows as T[]
  }

  async getFirstAsync<T = Row>(sql: string, ...params: unknown[]): Promise<T | null> {
    const all = await this.getAllAsync<T>(sql, ...params)
    return all[0] ?? null
  }

  async withTransactionAsync(fn: (tx: MockSQLiteDatabase) => Promise<void>) {
    await fn(this)
  }
}

let dbInstance: MockSQLiteDatabase | null = null

export async function openDatabaseAsync(_name: string): Promise<MockSQLiteDatabase> {
  if (!dbInstance) dbInstance = new MockSQLiteDatabase()
  return dbInstance
}

export function _resetDatabase() {
  if (dbInstance) dbInstance.clear()
}
