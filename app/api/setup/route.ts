import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET() {
  await sql`
    CREATE TABLE IF NOT EXISTS entries (
      id         SERIAL PRIMARY KEY,
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name          TEXT,
      role          TEXT NOT NULL DEFAULT 'user',
      permissions   JSONB NOT NULL DEFAULT '[]',
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Add profile columns if they don't exist
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]'`;

  const existing = await sql`SELECT id FROM users WHERE email = 'admin@example.com'`;
  if (existing.length === 0) {
    const hash = await bcrypt.hash("password123", 10);
    await sql`
      INSERT INTO users (email, password_hash, name, role, permissions)
      VALUES ('admin@example.com', ${hash}, 'Admin', 'admin', '["all"]')
    `;
  }

  return Response.json({
    ok: true,
    message: "Tables ready. Seed user: admin@example.com / password123",
  });
}
