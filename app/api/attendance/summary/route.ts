import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// GET /api/attendance/summary?date=YYYY-MM-DD
// Returns per-partner attendance summary for a given date (admin only)
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const rows = await sql`
    SELECT
      u.id        AS partner_id,
      u.name      AS partner_name,
      MIN(al.punched_at) FILTER (WHERE al.activity = 'punch_in')  AS punch_in_at,
      MAX(al.punched_at) FILTER (WHERE al.activity = 'punch_out') AS punch_out_at,
      COUNT(al.id)                                                  AS punch_count
    FROM users u
    LEFT JOIN attendance_logs al
      ON al.partner_id = u.id
      AND DATE(al.punched_at AT TIME ZONE 'UTC') = ${date}
    WHERE u.role = 'partner'
    GROUP BY u.id, u.name
    ORDER BY u.name ASC
  `;

  return Response.json(rows);
}
