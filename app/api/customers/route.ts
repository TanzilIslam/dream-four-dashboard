import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createCustomerSchema } from "@/lib/schemas/customer";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const onlyInactive = url.searchParams.get("inactive") === "true";
  const activeFilter = onlyInactive ? sql`c.is_active = false` : sql`c.is_active = true`;

  const customers =
    user.role === "admin"
      ? await sql`
          SELECT c.*,
                 a.name  AS area_name,
                 pt.name AS tier_name,
                 u.name  AS partner_name
          FROM customers c
          LEFT JOIN areas a         ON a.id = c.area_id
          LEFT JOIN pricing_tiers pt ON pt.id = c.pricing_tier_id
          LEFT JOIN users u          ON u.id = c.partner_id
          WHERE ${activeFilter}
          ORDER BY c.name ASC
        `
      : await sql`
          SELECT c.*,
                 a.name  AS area_name,
                 pt.name AS tier_name
          FROM customers c
          LEFT JOIN areas a          ON a.id = c.area_id
          LEFT JOIN pricing_tiers pt ON pt.id = c.pricing_tier_id
          WHERE c.partner_id = ${user.id} AND ${activeFilter}
          ORDER BY c.name ASC
        `;

  return Response.json(customers);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  const parsed = createCustomerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [customer] = await sql`
    INSERT INTO customers (
      partner_id, area_id, name, phone, whatsapp, address,
      pricing_tier_id, due_allowed, max_due,
      delivery_frequency, delivery_interval, customer_type, notes, is_active
    ) VALUES (
      ${user.id}, ${d.area_id}, ${d.name},
      ${d.phone || null}, ${d.whatsapp || null}, ${d.address || null},
      ${d.pricing_tier_id ?? null}, ${d.due_allowed}, ${d.max_due},
      ${d.delivery_frequency}, ${d.delivery_interval},
      ${d.customer_type ?? null}, ${d.notes || null}, ${d.is_active}
    )
    RETURNING *
  `;

  return Response.json(customer, { status: 201 });
}
