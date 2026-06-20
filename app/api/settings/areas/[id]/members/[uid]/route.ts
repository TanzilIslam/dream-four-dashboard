import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; uid: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id, uid } = await params;
  await sql`
    UPDATE user_areas SET is_active = false
    WHERE area_id = ${id} AND user_id = ${uid}
  `;

  return Response.json({ ok: true });
}
