import { sessionOptions, AppSession } from "@/lib/session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export async function GET() {
  const session = await getIronSession<AppSession>(await cookies(), sessionOptions);
  if (!session.user) {
    return Response.json({ user: null }, { status: 401 });
  }
  return Response.json({ user: session.user });
}
