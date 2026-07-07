import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createPurchaseSchema } from "@/lib/schemas/purchase-request";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const requests = await sql`
    SELECT pr.*,
           s.name  AS supplier_name,
           p.name  AS product_name,
           p.unit  AS product_unit,
           u.name  AS partner_name,
           COALESCE(sp.paid_total, 0) AS paid_total,
           GREATEST(0, COALESCE(pr.actual_total, 0) - COALESCE(sp.paid_total, 0)) AS due_amount
    FROM purchase_requests pr
    LEFT JOIN suppliers s ON s.id = pr.supplier_id
    LEFT JOIN products p  ON p.id = pr.product_id
    LEFT JOIN users u     ON u.id = pr.partner_id
    LEFT JOIN (
      SELECT purchase_request_id, SUM(amount) AS paid_total
      FROM supplier_payments
      GROUP BY purchase_request_id
    ) sp ON sp.purchase_request_id = pr.id
    WHERE pr.status = 'purchased'
    ORDER BY pr.created_at DESC
  `;

  return Response.json(requests);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  const parsed = createPurchaseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const unit_cost = d.actual_price + d.unit_transport_cost + d.unit_label_cost + d.unit_other_cost;
  const actual_total = unit_cost * d.actual_qty;

  const [req] = await sql`
    INSERT INTO purchase_requests (
      partner_id, supplier_id, product_id,
      requested_qty, estimated_price, estimated_total,
      actual_qty, actual_price, actual_total,
      unit, unit_transport_cost, unit_label_cost, unit_other_cost,
      purchased_at, payment_method, from_personal,
      note, remarks, status, completed_at
    ) VALUES (
      ${user.id}, ${d.supplier_id}, ${d.product_id},
      ${d.actual_qty}, ${d.actual_price}, ${actual_total},
      ${d.actual_qty}, ${d.actual_price}, ${actual_total},
      ${d.unit || null}, ${d.unit_transport_cost}, ${d.unit_label_cost}, ${d.unit_other_cost},
      ${d.purchased_at}, ${d.payment_method || null}, ${d.from_personal},
      ${d.note || null}, ${d.remarks || null}, 'purchased', NOW()
    )
    RETURNING *
  `;

  if (d.assets && d.assets.length > 0) {
    for (const a of d.assets) {
      await sql`
        INSERT INTO purchase_request_assets (purchase_request_id, asset_id, quantity)
        VALUES (${req.id}, ${a.asset_id}, ${a.quantity})
      `;
    }
  }

  return Response.json(req, { status: 201 });
}
