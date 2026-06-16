import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const ssl =
  process.env.DATABASE_SSL === "require"
    ? {
        rejectUnauthorized:
          process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
      }
    : false;

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl,
      max: Number(process.env.DATABASE_POOL_SIZE || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
    })
  : null;

export function requirePool() {
  if (!pool) {
    const error = new Error(
      "DATABASE_URL is not configured. See .env.example and README.md.",
    );
    error.statusCode = 503;
    throw error;
  }
  return pool;
}

export async function withTransaction(callback) {
  const client = await requirePool().connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function databaseHealth() {
  if (!pool) return { configured: false, connected: false };
  try {
    await pool.query("select 1");
    return { configured: true, connected: true };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      error: error.message,
    };
  }
}
