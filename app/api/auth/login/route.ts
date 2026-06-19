import { sql } from "@/lib/db";
import { sessionOptions, AppSession } from "@/lib/session";
import { getIronSession } from "iron-session";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }

  const [user] = await sql`
    SELECT id, email, password_hash, name, role, permissions
    FROM users WHERE email = ${email}
  `;

  if (!user) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const session = await getIronSession<AppSession>(await cookies(), sessionOptions);
  session.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
  };
  await session.save();

  return Response.json({ ok: true });
}
