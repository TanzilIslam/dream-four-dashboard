import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

const assetSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

// GET /api/products/[id]/assets
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const assets = await sql`
    SELECT * FROM product_assets
    WHERE product_id = ${id} AND is_active = true
    ORDER BY id ASC
  `;
  return Response.json(assets);
}

// POST /api/products/[id]/assets
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = assetSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const [asset] = await sql`
    INSERT INTO product_assets (product_id, name)
    VALUES (${id}, ${parsed.data.name})
    RETURNING *
  `;
  return Response.json(asset, { status: 201 });
}
