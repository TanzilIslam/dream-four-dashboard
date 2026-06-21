import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { assignMemberSchema } from "@/lib/schemas/area";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const members = await sql`
    SELECT ua.id, ua.user_id, ua.is_active, ua.assigned_at, u.name, u.email
    FROM user_areas ua
    JOIN users u ON u.id = ua.user_id
    WHERE ua.area_id = ${id} AND ua.is_active = true
    ORDER BY ua.assigned_at DESC
  `;

  return Response.json(members);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = assignMemberSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { user_id } = parsed.data;

  // One active partner per area: deactivate any existing active assignment first.
  await sql`UPDATE user_areas SET is_active = false WHERE area_id = ${id} AND is_active = true`;

  // Re-activate (or create) the assignment for this partner.
  const [assignment] = await sql`
    INSERT INTO user_areas (user_id, area_id, is_active, assigned_at)
    VALUES (${user_id}, ${id}, true, NOW())
    ON CONFLICT (user_id, area_id)
    DO UPDATE SET is_active = true, assigned_at = NOW()
    RETURNING *
  `;

  return Response.json(assignment, { status: 201 });
}
