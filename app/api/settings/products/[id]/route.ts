import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { productSchema } from "@/lib/schemas/product";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = productSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [product] = await sql`
    UPDATE products SET
      name = ${d.name}, unit = ${d.unit}, default_price = ${d.default_price ?? null},
      low_stock_threshold = ${d.low_stock_threshold}, is_active = ${d.is_active}
    WHERE id = ${id}
    RETURNING *
  `;

  if (!product) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(product);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await sql`UPDATE products SET is_active = false WHERE id = ${id}`;
  return Response.json({ ok: true });
}
