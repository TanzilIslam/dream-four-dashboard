import { sql } from "@/lib/db";

export async function GET() {
  const entries = await sql`
    SELECT id, content, created_at FROM entries ORDER BY created_at DESC
  `;
  return Response.json(entries);
}

export async function POST(request: Request) {
  const { content } = await request.json();

  if (!content || typeof content !== "string" || content.trim() === "") {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  const [entry] = await sql`
    INSERT INTO entries (content) VALUES (${content.trim()}) RETURNING id, content, created_at
  `;
  return Response.json(entry, { status: 201 });
}
