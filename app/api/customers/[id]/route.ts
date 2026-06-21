import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { updateCustomerSchema } from "@/lib/schemas/customer";

async function getCustomer(id: number) {
  const [customer] = await sql`SELECT * FROM customers WHERE id = ${id}`;
  return customer ?? null;
}

function canAccess(user: { id: number; role: string }, customer: Record<string, unknown>) {
  return user.role === "admin" || customer.partner_id === user.id;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const customer = await getCustomer(Number(id));
  if (!customer) return Response.json({ error: "Not found" }, { status: 404 });
  if (!canAccess(auth.user, customer))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updateCustomerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [updated] = await sql`
    UPDATE customers SET
      area_id           = ${d.area_id},
      name              = ${d.name},
      phone             = ${d.phone || null},
      whatsapp          = ${d.whatsapp || null},
      address           = ${d.address || null},
      pricing_tier_id   = ${d.pricing_tier_id ?? null},
      due_allowed       = ${d.due_allowed ?? customer.due_allowed},
      max_due           = ${d.max_due ?? customer.max_due},
      delivery_frequency = ${d.delivery_frequency ?? customer.delivery_frequency},
      delivery_interval = ${d.delivery_interval ?? customer.delivery_interval},
      customer_type     = ${d.customer_type ?? null},
      notes             = ${d.notes || null},
      is_active         = ${d.is_active ?? customer.is_active},
      updated_at        = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return Response.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const customer = await getCustomer(Number(id));
  if (!customer) return Response.json({ error: "Not found" }, { status: 404 });
  if (!canAccess(auth.user, customer))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  await sql`UPDATE customers SET is_active = false, updated_at = NOW() WHERE id = ${id}`;
  return new Response(null, { status: 204 });
}
