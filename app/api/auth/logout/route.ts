import { sessionOptions } from "@/lib/session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export async function POST() {
  const session = await getIronSession(await cookies(), sessionOptions);
  session.destroy();
  return Response.json({ ok: true });
}
