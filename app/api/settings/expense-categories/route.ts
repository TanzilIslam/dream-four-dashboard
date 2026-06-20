import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { expenseCategorySchema } from "@/lib/schemas/expense-category";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const categories = await sql`SELECT * FROM expense_categories ORDER BY name ASC`;
  return Response.json(categories);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = expenseCategorySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;
  const [category] = await sql`
    INSERT INTO expense_categories (name, icon)
    VALUES (${d.name}, ${d.icon || null})
    RETURNING *
  `;

  return Response.json(category, { status: 201 });
}
