import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { areaSchema } from "@/lib/schemas/area";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const includeInactive = new URL(request.url).searchParams.get("all") === "true";

  // Include the currently assigned (active) partner's name for each area.
  const areas = includeInactive
    ? await sql`
        SELECT a.*, u.id AS assigned_partner_id, u.name AS assigned_partner_name
        FROM areas a
        LEFT JOIN user_areas ua ON ua.area_id = a.id AND ua.is_active = true
        LEFT JOIN users u ON u.id = ua.user_id
        ORDER BY a.name ASC
      `
    : await sql`
        SELECT a.*, u.id AS assigned_partner_id, u.name AS assigned_partner_name
        FROM areas a
        LEFT JOIN user_areas ua ON ua.area_id = a.id AND ua.is_active = true
        LEFT JOIN users u ON u.id = ua.user_id
        WHERE a.is_active = true
        ORDER BY a.name ASC
      `;

  return Response.json(areas);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = areaSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [area] = await sql`
    INSERT INTO areas (name, description, is_active)
    VALUES (${d.name}, ${d.description || null}, ${d.is_active})
    RETURNING *
  `;

  return Response.json(area, { status: 201 });
}
