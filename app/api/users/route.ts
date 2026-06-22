import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createUserSchema } from "@/lib/schemas/user";
import bcrypt from "bcryptjs";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const users = await sql`
    SELECT id, name, email, role, permissions, created_at
    FROM users ORDER BY created_at DESC
  `;
  return Response.json(users);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, email, password, role } = parsed.data;

  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing.length > 0) {
    return Response.json({ error: { email: ["Email already in use"] } }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const [user] = await sql`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (${name}, ${email}, ${password_hash}, ${role})
    RETURNING id, name, email, role, created_at
  `;

  return Response.json(user, { status: 201 });
}
