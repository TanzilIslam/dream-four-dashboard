import { sql } from "@/lib/db";
import { sessionOptions, AppSession } from "@/lib/session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const { id } = await request.json();

  const [user] = await sql`
    SELECT id, email, name, role, permissions FROM users WHERE id = ${id}
  `;

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
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
