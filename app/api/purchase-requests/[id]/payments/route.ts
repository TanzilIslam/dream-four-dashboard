import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { addSupplierPaymentSchema } from "@/lib/schemas/purchase-request";

async function getPurchaseRequest(id: number) {
  const [pr] = await sql`SELECT * FROM purchase_requests WHERE id = ${id}`;
  return pr ?? null;
}

// GET /api/purchase-requests/[id]/payments
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const pr = await getPurchaseRequest(Number(id));
  if (!pr) return Response.json({ error: "Not found" }, { status: 404 });

  const payments = await sql`
    SELECT sp.*, u.name AS created_by_name
    FROM supplier_payments sp
    LEFT JOIN users u ON u.id = sp.created_by
    WHERE sp.purchase_request_id = ${id}
    ORDER BY sp.paid_at, sp.created_at
  `;

  const [{ paid_total }] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS paid_total
    FROM supplier_payments
    WHERE purchase_request_id = ${id}
  `;

  const actual_total = Number(pr.actual_total ?? 0);
  const paid = Number(paid_total);
  const due_amount = Math.max(0, actual_total - paid);

  return Response.json({ payments, paid_total: paid, due_amount, actual_total });
}

// POST /api/purchase-requests/[id]/payments
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const { id } = await params;
  const pr = await getPurchaseRequest(Number(id));
  if (!pr) return Response.json({ error: "Not found" }, { status: 404 });

  if (pr.status !== "purchased") {
    return Response.json({ error: "Can only add payments to purchased requests" }, { status: 400 });
  }

  const parsed = addSupplierPaymentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const [{ paid_total }] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS paid_total
    FROM supplier_payments
    WHERE purchase_request_id = ${id}
  `;

  const remaining_due = Number(pr.actual_total ?? 0) - Number(paid_total);
  if (parsed.data.amount > remaining_due) {
    return Response.json(
      {
        error: `Payment of ৳${parsed.data.amount.toFixed(2)} exceeds remaining due amount of ৳${remaining_due.toFixed(2)}`,
      },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const [payment] = await sql`
    INSERT INTO supplier_payments (
      purchase_request_id, amount, paid_at,
      payment_method, from_personal, note, created_by
    ) VALUES (
      ${id}, ${d.amount}, ${d.paid_at},
      ${d.payment_method || null}, ${d.from_personal ?? false}, ${d.note || null}, ${user.id}
    )
    RETURNING *
  `;

  return Response.json(payment, { status: 201 });
}
