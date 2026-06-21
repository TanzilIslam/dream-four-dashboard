import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { completeTaskSchema } from "@/lib/schemas/task";

// PATCH /api/tasks/:id — complete or reopen a task
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const { id } = await params;

  const [task] = await sql`SELECT * FROM tasks WHERE id = ${id}`;
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });

  // Only assigned partner or admin can update
  if (user.role !== "admin" && task.assigned_to !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const action = body.action as string;

  if (action === "complete") {
    const parsed = completeTaskSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const [updated] = await sql`
      UPDATE tasks
      SET status = 'completed', completed_at = NOW(), note = ${parsed.data.note || null}
      WHERE id = ${id}
      RETURNING *
    `;
    return Response.json(updated);
  }

  if (action === "reopen") {
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const [updated] = await sql`
      UPDATE tasks SET status = 'pending', completed_at = NULL WHERE id = ${id} RETURNING *
    `;
    return Response.json(updated);
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

// DELETE /api/tasks/:id — admin deletes task
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await sql`DELETE FROM tasks WHERE id = ${id}`;
  return new Response(null, { status: 204 });
}
