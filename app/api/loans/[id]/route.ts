import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// PATCH /api/loans/[id]  — mark returned or update
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const { action, returned_at } = body as { action: string; returned_at?: string };

  if (action === "return") {
    const [loan] = await sql`
      UPDATE simple_loans
      SET status      = 'returned',
          returned_at = ${returned_at || new Date().toISOString().slice(0, 10)}::date
      WHERE id = ${id}
      RETURNING *
    `;
    if (!loan) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(loan);
  }

  if (action === "reopen") {
    const [loan] = await sql`
      UPDATE simple_loans
      SET status = 'outstanding', returned_at = NULL
      WHERE id = ${id}
      RETURNING *
    `;
    if (!loan) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(loan);
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}

// DELETE /api/loans/[id]
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await sql`DELETE FROM simple_loans WHERE id = ${id}`;
  return Response.json({ ok: true });
}
