import { SessionOptions } from "iron-session";

export type SessionUser = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  permissions: string[];
};

export type AppSession = {
  user?: SessionUser;
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "app_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};
