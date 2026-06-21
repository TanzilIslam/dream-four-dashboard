import { sql } from "@/lib/db";
import { sessionOptions, AppSession } from "@/lib/session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  avatar_url: z.string().optional(),
  documents: z
    .array(
      z.object({
        type: z.string(),
        name: z.string(),
        url: z.string(),
      })
    )
    .optional(),
});

export async function GET() {
  const session = await getIronSession<AppSession>(await cookies(), sessionOptions);
  if (!session.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [user] = await sql`
    SELECT id, name, email, phone, whatsapp, avatar_url, documents, role, created_at
    FROM users WHERE id = ${session.user.id}
  `;
  return Response.json(user);
}

export async function PUT(request: Request) {
  const session = await getIronSession<AppSession>(await cookies(), sessionOptions);
  if (!session.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, email, phone, whatsapp, avatar_url, documents } = parsed.data;

  const [user] = await sql`
    UPDATE users SET
      name       = ${name},
      email      = ${email},
      phone      = ${phone ?? null},
      whatsapp   = ${whatsapp ?? null},
      avatar_url = ${avatar_url ?? null},
      documents  = ${JSON.stringify(documents ?? [])},
      updated_at = NOW()
    WHERE id = ${session.user.id}
    RETURNING id, name, email, phone, whatsapp, avatar_url, documents, role
  `;

  // Update session name
  session.user.name = user.name;
  await session.save();

  return Response.json(user);
}
