import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const partnerIdParam = url.searchParams.get("partner_id");

  const fromFilter = from ? sql`AND DATE(al.punched_at AT TIME ZONE 'UTC') >= ${from}` : sql``;
  const toFilter = to ? sql`AND DATE(al.punched_at AT TIME ZONE 'UTC') <= ${to}` : sql``;
  const partnerFilter =
    user.role === "admin" && partnerIdParam
      ? sql`AND al.partner_id = ${Number(partnerIdParam)}`
      : user.role !== "admin"
        ? sql`AND al.partner_id = ${user.id}`
        : sql``;

  // Per-day per-partner summary
  const rows = await sql`
    SELECT
      u.name AS partner_name,
      DATE(al.punched_at AT TIME ZONE 'UTC') AS work_date,
      MIN(al.punched_at) FILTER (WHERE al.activity = 'punch_in')  AS punch_in_at,
      MAX(al.punched_at) FILTER (WHERE al.activity = 'punch_out') AS punch_out_at,
      MIN(al.punched_at) FILTER (WHERE al.activity = 'farm_out')  AS farm_out_at,
      MAX(al.punched_at) FILTER (WHERE al.activity = 'farm_in')   AS farm_in_at,
      COUNT(al.id) AS total_punches
    FROM attendance_logs al
    JOIN users u ON u.id = al.partner_id
    WHERE 1=1 ${fromFilter} ${toFilter} ${partnerFilter}
    GROUP BY u.name, DATE(al.punched_at AT TIME ZONE 'UTC')
    ORDER BY work_date DESC, u.name ASC
  `;

  // Enrich with computed durations
  const enriched = rows.map((r) => {
    const pIn = r.punch_in_at ? new Date(r.punch_in_at) : null;
    const pOut = r.punch_out_at ? new Date(r.punch_out_at) : null;
    const fOut = r.farm_out_at ? new Date(r.farm_out_at) : null;
    const fIn = r.farm_in_at ? new Date(r.farm_in_at) : null;

    const totalMinutes = pIn && pOut ? Math.round((pOut.getTime() - pIn.getTime()) / 60000) : null;
    const farmMinutes = fOut && fIn ? Math.round((fIn.getTime() - fOut.getTime()) / 60000) : null;

    return {
      ...r,
      total_minutes: totalMinutes,
      farm_minutes: farmMinutes,
    };
  });

  return Response.json(enriched);
}
