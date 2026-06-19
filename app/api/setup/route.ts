import { sql } from "@/lib/db";

export async function GET() {
  await sql`
    CREATE TABLE IF NOT EXISTS entries (
      id        SERIAL PRIMARY KEY,
      content   TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  return Response.json({ ok: true, message: "Table created (or already exists)" });
}
