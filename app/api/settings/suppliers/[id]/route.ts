import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { supplierSchema } from "@/lib/schemas/supplier";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const parsed = supplierSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [supplier] = await sql`
    UPDATE suppliers SET
      name = ${d.name}, contact_person = ${d.contact_person || null},
      phone = ${d.phone || null}, whatsapp = ${d.whatsapp || null},
      email = ${d.email || null}, address = ${d.address || null}, area = ${d.area || null},
      bank_name = ${d.bank_name || null}, bank_account = ${d.bank_account || null},
      bkash = ${d.bkash || null}, nagad = ${d.nagad || null},
      default_price = ${d.default_price ?? null}, notes = ${d.notes || null},
      is_active = ${d.is_active}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  if (!supplier) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(supplier);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await sql`UPDATE suppliers SET is_active = false, updated_at = NOW() WHERE id = ${id}`;
  return Response.json({ ok: true });
}
