import { sql } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { supplierSchema } from "@/lib/schemas/supplier";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const onlyInactive = new URL(request.url).searchParams.get("inactive") === "true";

  const suppliers = onlyInactive
    ? await sql`SELECT * FROM suppliers WHERE is_active = false ORDER BY name ASC`
    : await sql`SELECT * FROM suppliers WHERE is_active = true ORDER BY name ASC`;

  return Response.json(suppliers);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = supplierSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [supplier] = await sql`
    INSERT INTO suppliers (
      name, contact_person, phone, whatsapp, email, address, area,
      bank_name, bank_account, bkash, nagad, default_price, notes, is_active
    ) VALUES (
      ${d.name}, ${d.contact_person || null}, ${d.phone || null}, ${d.whatsapp || null},
      ${d.email || null}, ${d.address || null}, ${d.area || null}, ${d.bank_name || null},
      ${d.bank_account || null}, ${d.bkash || null}, ${d.nagad || null},
      ${d.default_price ?? null}, ${d.notes || null}, ${d.is_active}
    )
    RETURNING *
  `;

  return Response.json(supplier, { status: 201 });
}
