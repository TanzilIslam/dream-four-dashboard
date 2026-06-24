import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createExpenseSchema } from "@/lib/schemas/expense";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const dateFilter = from && to ? sql`AND e.date BETWEEN ${from} :: DATE AND ${to} :: DATE` : sql``;

  const expenses =
    user.role === "admin"
      ? await sql`
          SELECT e.*,
                 ec.name AS category_name,
                 a.name  AS area_name,
                 p.name  AS product_name,
                 u.name  AS partner_name
          FROM expenses e
          LEFT JOIN expense_categories ec ON ec.id = e.category_id
          LEFT JOIN areas a               ON a.id = e.area_id
          LEFT JOIN products p            ON p.id = e.product_id
          LEFT JOIN users u               ON u.id = e.partner_id
          WHERE 1=1 ${dateFilter}
          ORDER BY e.date DESC, e.created_at DESC
        `
      : await sql`
          SELECT e.*,
                 ec.name AS category_name,
                 a.name  AS area_name,
                 p.name  AS product_name
          FROM expenses e
          LEFT JOIN expense_categories ec ON ec.id = e.category_id
          LEFT JOIN areas a               ON a.id = e.area_id
          LEFT JOIN products p            ON p.id = e.product_id
          WHERE e.partner_id = ${user.id} ${dateFilter}
          ORDER BY e.date DESC, e.created_at DESC
        `;

  return Response.json(expenses);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  const parsed = createExpenseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [expense] = await sql`
    INSERT INTO expenses (
      partner_id, category_id, area_id, product_id,
      amount, payment_method, description, date
    ) VALUES (
      ${user.id}, ${d.category_id}, ${d.area_id ?? null}, ${d.product_id ?? null},
      ${d.amount}, ${d.payment_method || null}, ${d.description || null}, ${d.date}
    )
    RETURNING *
  `;

  return Response.json(expense, { status: 201 });
}
