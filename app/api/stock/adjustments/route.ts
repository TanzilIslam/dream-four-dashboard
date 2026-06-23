import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createStockAdjustmentSchema } from "@/lib/schemas/stock-adjustment";

// Ensure table exists on every request (cheap IF NOT EXISTS check)
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id          SERIAL PRIMARY KEY,
      product_id  INTEGER NOT NULL REFERENCES products(id),
      quantity    INTEGER NOT NULL,
      reason      TEXT    NOT NULL,
      date        DATE    NOT NULL,
      note        TEXT,
      created_by  INTEGER REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await ensureTable();

  const adjustments = await sql`
    SELECT
      sa.id,
      sa.product_id,
      p.name  AS product_name,
      p.unit  AS product_unit,
      sa.quantity,
      sa.reason,
      sa.date,
      sa.note,
      sa.created_by,
      u.name  AS created_by_name,
      sa.created_at
    FROM stock_adjustments sa
    LEFT JOIN products p ON p.id = sa.product_id
    LEFT JOIN users   u ON u.id = sa.created_by
    ORDER BY sa.created_at DESC
  `;

  return Response.json(adjustments);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  await ensureTable();

  const parsed = createStockAdjustmentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;

  const [adj] = await sql`
    INSERT INTO stock_adjustments (product_id, quantity, reason, date, note, created_by)
    VALUES (${d.product_id}, ${d.quantity}, ${d.reason}, ${d.date}, ${d.note || null}, ${user.id})
    RETURNING *
  `;

  return Response.json(adj, { status: 201 });
}
