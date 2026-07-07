import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createPurchaseSchema } from "@/lib/schemas/purchase-request";

async function getRequest(id: number) {
  const [req] = await sql`SELECT * FROM purchase_requests WHERE id = ${id}`;
  return req ?? null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const pr = await getRequest(Number(id));
  if (!pr) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = createPurchaseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const unit_cost = d.actual_price + d.unit_transport_cost + d.unit_label_cost + d.unit_other_cost;
  const actual_total = unit_cost * d.actual_qty;

  // Remove old assets and re-insert
  await sql`DELETE FROM purchase_request_assets WHERE purchase_request_id = ${id}`;

  const [updated] = await sql`
    UPDATE purchase_requests SET
      supplier_id         = ${d.supplier_id},
      product_id          = ${d.product_id},
      requested_qty       = ${d.actual_qty},
      estimated_price     = ${d.actual_price},
      estimated_total     = ${actual_total},
      actual_qty          = ${d.actual_qty},
      actual_price        = ${d.actual_price},
      actual_total        = ${actual_total},
      unit                = ${d.unit || null},
      unit_transport_cost = ${d.unit_transport_cost},
      unit_label_cost     = ${d.unit_label_cost},
      unit_other_cost     = ${d.unit_other_cost},
      purchased_at        = ${d.purchased_at},
      payment_method      = ${d.payment_method || null},
      from_personal       = ${d.from_personal},
      note                = ${d.note || null},
      remarks             = ${d.remarks || null}
    WHERE id = ${id}
    RETURNING *
  `;

  if (d.assets && d.assets.length > 0) {
    for (const a of d.assets) {
      await sql`
        INSERT INTO purchase_request_assets (purchase_request_id, asset_id, quantity)
        VALUES (${id}, ${a.asset_id}, ${a.quantity})
      `;
    }
  }

  return Response.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const pr = await getRequest(Number(id));
  if (!pr) return Response.json({ error: "Not found" }, { status: 404 });

  await sql`DELETE FROM purchase_requests WHERE id = ${id}`;
  return new Response(null, { status: 204 });
}
