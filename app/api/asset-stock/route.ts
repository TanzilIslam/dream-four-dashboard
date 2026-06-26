import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// GET /api/asset-stock
// Returns computed stock for every active product asset:
//   available = received − sent_to_customers + returned_by_customers − returned_to_suppliers
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const rows = await sql`
    SELECT
      pa.id          AS asset_id,
      pa.product_id,
      pa.name        AS asset_name,
      p.name         AS product_name,
      COALESCE(SUM(pra.quantity), 0)                                            AS received,
      COALESCE((SELECT SUM(oa.quantity) FROM order_assets oa WHERE oa.asset_id = pa.id), 0) AS sent,
      COALESCE((SELECT SUM(oar.quantity) FROM order_asset_returns oar WHERE oar.asset_id = pa.id), 0) AS returned_by_customers,
      COALESCE((SELECT SUM(sar.quantity) FROM supplier_asset_returns sar WHERE sar.asset_id = pa.id), 0) AS returned_to_suppliers
    FROM product_assets pa
    JOIN products p ON p.id = pa.product_id
    LEFT JOIN purchase_request_assets pra ON pra.asset_id = pa.id
    WHERE pa.is_active = true
    GROUP BY pa.id, pa.product_id, pa.name, p.name
    ORDER BY pa.product_id, pa.id
  `;

  return Response.json(
    rows.map((r: Record<string, unknown>) => ({
      ...r,
      available:
        Number(r.received) -
        Number(r.sent) +
        Number(r.returned_by_customers) -
        Number(r.returned_to_suppliers),
    }))
  );
}
