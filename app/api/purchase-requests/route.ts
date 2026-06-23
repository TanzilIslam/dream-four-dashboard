import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createPurchaseRequestSchema } from "@/lib/schemas/purchase-request";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const status = url.searchParams.get("status"); // pending | approved | rejected | purchased | all

  const statusFilter = status && status !== "all" ? sql`AND pr.status = ${status}` : sql``;

  const requests =
    user.role === "admin"
      ? await sql`
          SELECT pr.*,
                 s.name  AS supplier_name,
                 p.name  AS product_name,
                 p.unit  AS product_unit,
                 u.name  AS partner_name
          FROM purchase_requests pr
          LEFT JOIN suppliers s ON s.id = pr.supplier_id
          LEFT JOIN products p  ON p.id = pr.product_id
          LEFT JOIN users u     ON u.id = pr.partner_id
          WHERE 1=1 ${statusFilter}
          ORDER BY pr.created_at DESC
        `
      : await sql`
          SELECT pr.*,
                 s.name  AS supplier_name,
                 p.name  AS product_name,
                 p.unit  AS product_unit
          FROM purchase_requests pr
          LEFT JOIN suppliers s ON s.id = pr.supplier_id
          LEFT JOIN products p  ON p.id = pr.product_id
          WHERE pr.partner_id = ${user.id} ${statusFilter}
          ORDER BY pr.created_at DESC
        `;

  return Response.json(requests);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  const parsed = createPurchaseRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const estimated_total = d.estimated_price != null ? d.estimated_price * d.requested_qty : null;

  const [req] = await sql`
    INSERT INTO purchase_requests (
      partner_id, supplier_id, product_id,
      requested_qty, estimated_price, estimated_total,
      note, status
    ) VALUES (
      ${user.id}, ${d.supplier_id}, ${d.product_id},
      ${d.requested_qty}, ${d.estimated_price ?? null}, ${estimated_total},
      ${d.note || null}, 'pending'
    )
    RETURNING *
  `;

  return Response.json(req, { status: 201 });
}
