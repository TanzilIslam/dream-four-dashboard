import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

const createSchema = z.object({
  supplier_id: z.number().int().positive("Supplier is required"),
  asset_id: z.number().int().positive("Asset is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  returned_at: z.string().min(1, "Date is required"),
  note: z.string().optional().or(z.literal("")),
});

// GET /api/supplier-asset-returns
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const rows = await sql`
    SELECT
      sar.*,
      s.name  AS supplier_name,
      pa.name AS asset_name,
      p.name  AS product_name,
      u.name  AS created_by_name
    FROM supplier_asset_returns sar
    JOIN suppliers s    ON s.id  = sar.supplier_id
    JOIN product_assets pa ON pa.id = sar.asset_id
    JOIN products p     ON p.id  = pa.product_id
    LEFT JOIN users u   ON u.id  = sar.created_by
    ORDER BY sar.returned_at DESC, sar.id DESC
  `;
  return Response.json(rows);
}

// POST /api/supplier-asset-returns
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [row] = await sql`
    INSERT INTO supplier_asset_returns (supplier_id, asset_id, quantity, returned_at, note, created_by)
    VALUES (${d.supplier_id}, ${d.asset_id}, ${d.quantity}, ${d.returned_at}, ${d.note || null}, ${user.id})
    RETURNING *
  `;
  return Response.json(row, { status: 201 });
}
