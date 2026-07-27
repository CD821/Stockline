import { databaseHealth, requirePool } from "../lib/db.mjs";

const health = await databaseHealth();
console.log(
  JSON.stringify(
    {
      configured: health.configured,
      connected: health.connected,
      error: health.error,
    },
    null,
    2,
  ),
);

if (!health.connected) {
  process.exitCode = 1;
} else {
  await requirePool().end();
}
