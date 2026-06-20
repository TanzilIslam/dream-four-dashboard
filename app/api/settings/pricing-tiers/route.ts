import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { pricingTierSchema } from "@/lib/schemas/pricing-tier";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const productId = new URL(request.url).searchParams.get("product_id");

  const tiers = productId
    ? await sql`
        SELECT t.*, p.name AS product_name, p.unit AS product_unit
        FROM pricing_tiers t
        JOIN products p ON p.id = t.product_id
        WHERE t.product_id = ${productId}
        ORDER BY t.min_qty ASC
      `
    : await sql`
        SELECT t.*, p.name AS product_name, p.unit AS product_unit
        FROM pricing_tiers t
        JOIN products p ON p.id = t.product_id
        ORDER BY p.name ASC, t.min_qty ASC
      `;

  return Response.json(tiers);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = pricingTierSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [tier] = await sql`
    INSERT INTO pricing_tiers (product_id, name, unit_price, min_qty)
    VALUES (${d.product_id}, ${d.name}, ${d.unit_price}, ${d.min_qty})
    RETURNING *
  `;

  return Response.json(tier, { status: 201 });
}
