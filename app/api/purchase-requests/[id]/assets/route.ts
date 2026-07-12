import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const assets = await sql`
    SELECT pra.asset_id, pra.quantity, pa.name AS asset_name
    FROM purchase_request_assets pra
    JOIN product_assets pa ON pa.id = pra.asset_id
    WHERE pra.purchase_request_id = ${id}
    ORDER BY pa.name ASC
  `;

  return Response.json(assets);
}
