import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createTaskSchema } from "@/lib/schemas/task";

// GET /api/tasks?status=pending|completed|all&date=YYYY-MM-DD
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";
  const date = url.searchParams.get("date");

  const statusFilter = status === "all" ? sql`` : sql`AND t.status = ${status}`;

  const dateFilter = date ? sql`AND (t.due_date = ${date} OR t.due_date IS NULL)` : sql``;

  const tasks =
    user.role === "admin"
      ? await sql`
          SELECT t.*, u.name AS assigned_to_name, c.name AS created_by_name
          FROM tasks t
          LEFT JOIN users u ON u.id = t.assigned_to
          LEFT JOIN users c ON c.id = t.created_by
          WHERE 1=1 ${statusFilter} ${dateFilter}
          ORDER BY
            CASE t.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
            t.due_date ASC NULLS LAST,
            t.created_at DESC
        `
      : await sql`
          SELECT t.*, u.name AS assigned_to_name, c.name AS created_by_name
          FROM tasks t
          LEFT JOIN users u ON u.id = t.assigned_to
          LEFT JOIN users c ON c.id = t.created_by
          WHERE t.assigned_to = ${user.id} ${statusFilter} ${dateFilter}
          ORDER BY
            CASE t.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
            t.due_date ASC NULLS LAST,
            t.created_at DESC
        `;

  return Response.json(tasks);
}

// POST /api/tasks — admin creates task
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  const parsed = createTaskSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const d = parsed.data;

  const [task] = await sql`
    INSERT INTO tasks (assigned_to, created_by, title, description, due_date, priority, type, is_self_task)
    VALUES (
      ${d.assigned_to},
      ${user.id},
      ${d.title},
      ${d.description || null},
      ${d.due_date || null},
      ${d.priority},
      ${d.type},
      ${d.assigned_to === user.id}
    )
    RETURNING *
  `;

  return Response.json(task, { status: 201 });
}
