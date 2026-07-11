import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createCustomerSchema } from "@/lib/schemas/customer";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const activeFilter =
    statusParam === "all"
      ? sql`true`
      : statusParam === "inactive"
        ? sql`c.is_active = false`
        : sql`c.is_active = true`;

  const customers =
    user.role === "admin"
      ? await sql`
          SELECT c.*,
                 a.name        AS area_name,
                 pt.name       AS tier_name,
                 pt.unit_price AS tier_unit_price,
                 pt.min_qty    AS tier_min_qty,
                 p.unit        AS tier_product_unit,
                 pt.product_id AS product_id,
                 p.name        AS product_name,
                 u.name        AS partner_name,
                 COALESCE((SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled'), 0)::int AS total_orders,
                 COALESCE((SELECT SUM(o.quantity) FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled'), 0)::int AS total_quantity,
                 COALESCE((SELECT SUM(o.paid_amount) FROM orders o WHERE o.customer_id = c.id AND o.status IN ('delivered', 'paid')), 0)::numeric AS total_paid,
                 COALESCE((SELECT SUM(o.due_amount) FROM orders o WHERE o.customer_id = c.id AND o.status IN ('delivered', 'paid')), 0)::numeric AS total_due,
                 COALESCE((SELECT SUM(oa.quantity) FROM order_assets oa JOIN orders o ON o.id = oa.order_id WHERE o.customer_id = c.id), 0)::int AS total_assets_sent,
                 GREATEST(0,
                   COALESCE((SELECT SUM(oa.quantity) FROM order_assets oa JOIN orders o ON o.id = oa.order_id WHERE o.customer_id = c.id), 0)
                   - COALESCE((SELECT SUM(oar.quantity) FROM order_asset_returns oar JOIN orders o ON o.id = oar.order_id WHERE o.customer_id = c.id), 0)
                 )::int AS unreturned_assets,
                 (SELECT MAX(o.ordered_at)::date FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled') AS last_order_date
          FROM customers c
          LEFT JOIN areas a          ON a.id = c.area_id
          LEFT JOIN pricing_tiers pt ON pt.id = c.pricing_tier_id
          LEFT JOIN products p       ON p.id = pt.product_id
          LEFT JOIN users u          ON u.id = c.partner_id
          WHERE ${activeFilter}
          ORDER BY c.name ASC
        `
      : await sql`
          SELECT c.*,
                 a.name        AS area_name,
                 pt.name       AS tier_name,
                 pt.unit_price AS tier_unit_price,
                 pt.min_qty    AS tier_min_qty,
                 p.unit        AS tier_product_unit,
                 pt.product_id AS product_id,
                 p.name        AS product_name,
                 COALESCE((SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled'), 0)::int AS total_orders,
                 COALESCE((SELECT SUM(o.quantity) FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled'), 0)::int AS total_quantity,
                 COALESCE((SELECT SUM(o.paid_amount) FROM orders o WHERE o.customer_id = c.id AND o.status IN ('delivered', 'paid')), 0)::numeric AS total_paid,
                 COALESCE((SELECT SUM(o.due_amount) FROM orders o WHERE o.customer_id = c.id AND o.status IN ('delivered', 'paid')), 0)::numeric AS total_due,
                 COALESCE((SELECT SUM(oa.quantity) FROM order_assets oa JOIN orders o ON o.id = oa.order_id WHERE o.customer_id = c.id), 0)::int AS total_assets_sent,
                 GREATEST(0,
                   COALESCE((SELECT SUM(oa.quantity) FROM order_assets oa JOIN orders o ON o.id = oa.order_id WHERE o.customer_id = c.id), 0)
                   - COALESCE((SELECT SUM(oar.quantity) FROM order_asset_returns oar JOIN orders o ON o.id = oar.order_id WHERE o.customer_id = c.id), 0)
                 )::int AS unreturned_assets,
                 (SELECT MAX(o.ordered_at)::date FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled') AS last_order_date
          FROM customers c
          LEFT JOIN areas a          ON a.id = c.area_id
          LEFT JOIN pricing_tiers pt ON pt.id = c.pricing_tier_id
          LEFT JOIN products p       ON p.id = pt.product_id
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
