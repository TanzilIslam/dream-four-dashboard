import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { pricingTierSchema } from "@/lib/schemas/pricing-tier";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = pricingTierSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [tier] = await sql`
    UPDATE pricing_tiers SET
      product_id = ${d.product_id}, name = ${d.name},
      unit_price = ${d.unit_price}, min_qty = ${d.min_qty}
    WHERE id = ${id}
    RETURNING *
  `;

  if (!tier) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(tier);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const inUse = await sql`SELECT 1 FROM customers WHERE pricing_tier_id = ${id} LIMIT 1`;
  if (inUse.length > 0)
    return Response.json(
      { error: "This pricing tier is assigned to one or more customers" },
      { status: 409 }
    );

  await sql`DELETE FROM pricing_tiers WHERE id = ${id}`;
  return Response.json({ ok: true });
}
