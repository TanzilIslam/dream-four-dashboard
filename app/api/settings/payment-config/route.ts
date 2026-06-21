import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { paymentConfigSchema } from "@/lib/schemas/payment-config";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let [config] = await sql`SELECT * FROM payment_settings WHERE id = 1`;
  if (!config) {
    [config] = await sql`INSERT INTO payment_settings (id) VALUES (1) RETURNING *`;
  }
  return Response.json(config);
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = paymentConfigSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [config] = await sql`
    UPDATE payment_settings SET
      due_allowed = ${d.due_allowed},
      max_due_per_customer = ${d.max_due_per_customer},
      late_punch_threshold = ${d.late_punch_threshold},
      low_stock_default = ${d.low_stock_default},
      updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `;

  return Response.json(config);
}
