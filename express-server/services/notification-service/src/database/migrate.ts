import fs from 'fs';
import path from 'path';
import { db, connectDatabase, disconnectDatabase } from '../lib/knex';
import { logger } from '../lib/logger';

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await db.raw(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getExecutedMigrations(): Promise<string[]> {
  const rows = await db('schema_migrations').select('filename').orderBy('id', 'asc');

  return rows.map((r: { filename: string }) => r.filename);
}

async function runMigrations(): Promise<void> {
  await connectDatabase();
  await ensureMigrationsTable();

  const executed = await getExecutedMigrations();
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const pending = files.filter((f) => !executed.includes(f));

  if (pending.length === 0) {
    logger.info('No pending migrations');
    await disconnectDatabase();

    return;
  }

  for (const file of pending) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    logger.info(`Running migration: ${file}`);

    // Split by semicolons (handles multi-statement files) and filter empty
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await db.raw(stmt);
    }

    await db('schema_migrations').insert({ filename: file });
    logger.info(`Migration complete: ${file}`);
  }

  logger.info(`Ran ${pending.length} migration(s) successfully`);
  await disconnectDatabase();
}

runMigrations().catch((err) => {
  logger.error('Migration failed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
