import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, AppSession, SessionUser } from "@/lib/session";

/** Returns the logged-in user, or null if there is no session. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getIronSession<AppSession>(await cookies(), sessionOptions);
  return session.user ?? null;
}

type AuthResult = { user: SessionUser } | { error: Response };

/** Require any authenticated session. */
export async function requireUser(): Promise<AuthResult> {
  const user = await getSessionUser();
  if (!user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user };
}

/** Require an authenticated admin. */
export async function requireAdmin(): Promise<AuthResult> {
  const user = await getSessionUser();
  if (!user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "admin") return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}
