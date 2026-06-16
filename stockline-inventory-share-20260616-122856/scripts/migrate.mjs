import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { requirePool } from "../lib/db.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const migrationsDir = join(root, "db", "migrations");
const client = await requirePool().connect();

try {
  await client.query("select pg_advisory_lock(hashtext('stockline_migrations'))");
  await client.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const appliedResult = await client.query(
    "select name from schema_migrations order by name",
  );
  const applied = new Set(appliedResult.rows.map((row) => row.name));
  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const name of files) {
    if (applied.has(name)) continue;
    const sql = await readFile(join(migrationsDir, name), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into schema_migrations (name) values ($1)",
        [name],
      );
      await client.query("commit");
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.query(
    "select pg_advisory_unlock(hashtext('stockline_migrations'))",
  );
  client.release();
  await requirePool().end();
}
