import { requirePool } from "../lib/db.mjs";
import {
  INVENTORY_DATA_VERSION,
  REAL_INVENTORY_ROWS,
} from "../db/seed/inventory-data.mjs";

const database = requirePool();
const client = await database.connect();

let inserted = 0;
let updated = 0;
let unchanged = 0;

try {
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock(hashtext('stockline_inventory_sync'))");

  for (const [
    name,
    idNumber,
    quantity,
    sourceRow,
    notes = "",
    division = "TTS",
  ] of REAL_INVENTORY_ROWS) {
    const sourceKey = `sharepoint-${sourceRow}`;
    const current = await client.query(
      "select * from inventory_items where source_key = $1 for update",
      [sourceKey],
    );

    if (!current.rowCount) {
      await client.query(
        `
          insert into inventory_items (
            source_key, name, id_number, quantity, division, notes
          )
          values ($1, $2, $3, $4, $5, $6)
        `,
        [sourceKey, name, idNumber, quantity, division, notes],
      );
      inserted += 1;
      continue;
    }

    const row = current.rows[0];
    const nextQuantity = Math.max(Number(quantity), Number(row.reserved || 0));
    const nextStatus =
      row.status === "Archived" && nextQuantity > 0 ? "Active" : row.status;
    const changed =
      row.name !== name ||
      row.id_number !== idNumber ||
      Number(row.quantity) !== nextQuantity ||
      row.division !== division ||
      row.notes !== notes ||
      row.status !== nextStatus;

    if (!changed) {
      unchanged += 1;
      continue;
    }

    await client.query(
      `
        update inventory_items set
          name = $2,
          id_number = $3,
          quantity = $4,
          division = $5,
          notes = $6,
          status = $7
        where id = $1
      `,
      [row.id, name, idNumber, nextQuantity, division, notes, nextStatus],
    );
    updated += 1;
  }

  await client.query(
    `
      insert into audit_logs (
        user_name_snapshot, action, item, quantity, details
      )
      values ('System', 'Inventory synced', 'SharePoint Inventory', $1, $2)
    `,
    [
      REAL_INVENTORY_ROWS.length,
      `${INVENTORY_DATA_VERSION}: ${inserted} added, ${updated} updated, ${unchanged} unchanged`,
    ],
  );

  await client.query("commit");
  console.log(
    `Inventory sync complete: ${inserted} added, ${updated} updated, ${unchanged} unchanged.`,
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await database.end();
}
