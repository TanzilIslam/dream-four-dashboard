import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { productSchema } from "@/lib/schemas/product";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const onlyInactive = new URL(request.url).searchParams.get("inactive") === "true";

  const products = onlyInactive
    ? await sql`SELECT * FROM products WHERE is_active = false ORDER BY name ASC`
    : await sql`SELECT * FROM products WHERE is_active = true ORDER BY name ASC`;

  return Response.json(products);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = productSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [product] = await sql`
    INSERT INTO products (name, unit, default_price, low_stock_threshold, is_active)
    VALUES (${d.name}, ${d.unit}, ${d.default_price ?? null}, ${d.low_stock_threshold}, ${d.is_active})
    RETURNING *
  `;

  return Response.json(product, { status: 201 });
}
