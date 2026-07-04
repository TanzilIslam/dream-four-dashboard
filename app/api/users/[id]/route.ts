import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { updateUserSchema } from "@/lib/schemas/user";
import bcrypt from "bcryptjs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, email, password, role } = parsed.data;

  const existing = await sql`SELECT id FROM users WHERE email = ${email} AND id != ${id}`;
  if (existing.length > 0) {
    return Response.json({ error: { email: ["Email already in use"] } }, { status: 409 });
  }

  if (password) {
    const password_hash = await bcrypt.hash(password, 10);
    await sql`
      UPDATE users SET name=${name}, email=${email}, password_hash=${password_hash}, role=${role}, updated_at=NOW()
      WHERE id=${id}
    `;
  } else {
    await sql`
      UPDATE users SET name=${name}, email=${email}, role=${role}, updated_at=NOW()
      WHERE id=${id}
    `;
  }

  const [user] = await sql`SELECT id, name, email, role, created_at FROM users WHERE id=${id}`;
  return Response.json(user);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await sql`DELETE FROM users WHERE id=${id}`;
  return Response.json({ ok: true });
}
