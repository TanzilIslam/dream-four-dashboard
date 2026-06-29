import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS simple_loans (
      id          SERIAL PRIMARY KEY,
      person_name TEXT    NOT NULL,
      amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      reason      TEXT,
      note        TEXT,
      loaned_at   DATE    NOT NULL DEFAULT CURRENT_DATE,
      status      TEXT    NOT NULL DEFAULT 'outstanding',
      returned_at DATE,
      created_by  INTEGER REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// GET /api/loans
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await ensureTable();

  const loans = await sql`
    SELECT l.*, u.name AS created_by_name
    FROM simple_loans l
    LEFT JOIN users u ON u.id = l.created_by
    ORDER BY l.loaned_at DESC, l.id DESC
  `;

  return Response.json(loans);
}

// POST /api/loans
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  await ensureTable();

  const { user } = auth;
  const body = await request.json();
  const { person_name, amount, reason, note, loaned_at } = body as {
    person_name: string;
    amount: number;
    reason?: string;
    note?: string;
    loaned_at?: string;
  };

  if (!person_name?.trim()) {
    return Response.json({ error: "Person name is required" }, { status: 400 });
  }
  if (!amount || amount <= 0) {
    return Response.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }

  const [loan] = await sql`
    INSERT INTO simple_loans (person_name, amount, reason, note, loaned_at, created_by)
    VALUES (
      ${person_name.trim()},
      ${amount},
      ${reason || null},
      ${note || null},
      ${loaned_at || new Date().toISOString().slice(0, 10)},
      ${user.id}
    )
    RETURNING *
  `;

  return Response.json(loan, { status: 201 });
}
