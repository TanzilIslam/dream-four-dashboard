import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// PATCH /api/daily-reports/:id — submit (partner) or review (admin)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const { id } = await params;

  const [report] = await sql`SELECT * FROM daily_reports WHERE id = ${id}`;
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });

  const body = await request.json();
  const action = body.action as string;

  if (action === "submit") {
    if (report.partner_id !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const [updated] = await sql`
      UPDATE daily_reports
      SET status = 'submitted', member_note = ${body.note || null}, submitted_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return Response.json(updated);
  }

  if (action === "review") {
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const [updated] = await sql`
      UPDATE daily_reports
      SET status = 'reviewed', reviewed_by = ${user.id}, reviewed_at = NOW(), admin_note = ${body.admin_note || null}
      WHERE id = ${id}
      RETURNING *
    `;
    return Response.json(updated);
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
