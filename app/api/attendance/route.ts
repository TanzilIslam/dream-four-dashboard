import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { punchSchema } from "@/lib/schemas/attendance";

// GET /api/attendance?date=YYYY-MM-DD&partner_id=N
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const partnerIdParam = url.searchParams.get("partner_id");

  // Admin can query any partner; partner can only query themselves
  const targetId = user.role === "admin" && partnerIdParam ? Number(partnerIdParam) : user.id;

  const logs = await sql`
    SELECT al.*, u.name AS partner_name
    FROM attendance_logs al
    JOIN users u ON u.id = al.partner_id
    WHERE al.partner_id = ${targetId}
      AND DATE(al.punched_at AT TIME ZONE 'UTC') = ${date}
    ORDER BY al.punched_at ASC
  `;

  return Response.json(logs);
}

// POST /api/attendance — record a punch
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  const parsed = punchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;

  const [log] = await sql`
    INSERT INTO attendance_logs (partner_id, activity, punched_at, note, location)
    VALUES (
      ${user.id},
      ${d.activity},
      ${d.punched_at},
      ${d.note || null},
      ${d.location || null}
    )
    RETURNING *
  `;

  return Response.json(log, { status: 201 });
}
