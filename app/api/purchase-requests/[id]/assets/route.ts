import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const assets = await sql`
    SELECT asset_id, quantity
    FROM purchase_request_assets
    WHERE purchase_request_id = ${id}
  `;

  return Response.json(assets);
}
