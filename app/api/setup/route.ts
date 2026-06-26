import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name          TEXT,
      role          TEXT NOT NULL DEFAULT 'partner',
      permissions   JSONB NOT NULL DEFAULT '[]',
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Extend users with profile + contact columns
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]'`;

  // ── Master data ───────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS suppliers (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,
      contact_person  TEXT,
      phone           TEXT,
      whatsapp        TEXT,
      email           TEXT,
      address         TEXT,
      area            TEXT,
      bank_name       TEXT,
      bank_account    TEXT,
      bkash           TEXT,
      nagad           TEXT,
      default_price   NUMERIC(12,2),
      notes           TEXT,
      is_active       BOOLEAN DEFAULT true,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS areas (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      is_active   BOOLEAN DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_areas (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      area_id     INTEGER REFERENCES areas(id) ON DELETE CASCADE,
      is_active   BOOLEAN DEFAULT true,
      assigned_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, area_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id                   SERIAL PRIMARY KEY,
      name                 TEXT NOT NULL,
      unit                 TEXT NOT NULL DEFAULT 'piece',
      default_price        NUMERIC(12,2),
      low_stock_threshold  INTEGER DEFAULT 100,
      is_active            BOOLEAN DEFAULT true,
      created_at           TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS pricing_tiers (
      id          SERIAL PRIMARY KEY,
      product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      unit_price  NUMERIC(12,2) NOT NULL,
      min_qty     INTEGER DEFAULT 1,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      icon       TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS payment_settings (
      id                    SERIAL PRIMARY KEY,
      due_allowed           BOOLEAN DEFAULT true,
      max_due_per_customer  NUMERIC(12,2) DEFAULT 1000,
      late_punch_threshold  TIME DEFAULT '09:30',
      low_stock_default     INTEGER DEFAULT 100,
      updated_at            TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`INSERT INTO payment_settings (id) VALUES (1) ON CONFLICT DO NOTHING`;

  // ── Operations ────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id                  SERIAL PRIMARY KEY,
      partner_id          INTEGER REFERENCES users(id),
      area_id             INTEGER REFERENCES areas(id),
      name                TEXT NOT NULL,
      phone               TEXT,
      whatsapp            TEXT,
      address             TEXT,
      pricing_tier_id     INTEGER REFERENCES pricing_tiers(id),
      due_allowed         BOOLEAN DEFAULT true,
      max_due             NUMERIC(12,2) DEFAULT 1000,
      delivery_frequency  TEXT DEFAULT 'daily',
      delivery_interval   INTEGER DEFAULT 1,
      is_paused           BOOLEAN DEFAULT false,
      pause_start         DATE,
      pause_until         DATE,
      pause_reason        TEXT,
      notes               TEXT,
      is_active           BOOLEAN DEFAULT true,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      updated_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id               SERIAL PRIMARY KEY,
      partner_id       INTEGER REFERENCES users(id),
      supplier_id      INTEGER REFERENCES suppliers(id),
      product_id       INTEGER REFERENCES products(id),
      requested_qty    INTEGER NOT NULL,
      estimated_price  NUMERIC(12,2),
      estimated_total  NUMERIC(12,2),
      status           TEXT DEFAULT 'pending',
      admin_note       TEXT,
      approved_by      INTEGER REFERENCES users(id),
      approved_at      TIMESTAMPTZ,
      actual_qty       INTEGER,
      actual_price     NUMERIC(12,2),
      actual_total     NUMERIC(12,2),
      purchased_at     DATE,
      payment_method   TEXT,
      from_personal    BOOLEAN DEFAULT false,
      note             TEXT,
      completed_at     TIMESTAMPTZ,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS supplier_payments (
      id                    SERIAL PRIMARY KEY,
      purchase_request_id   INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
      amount                NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      paid_at               DATE NOT NULL,
      payment_method        TEXT,
      from_personal         BOOLEAN DEFAULT false,
      note                  TEXT,
      created_by            INTEGER REFERENCES users(id),
      created_at            TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id                     SERIAL PRIMARY KEY,
      partner_id             INTEGER REFERENCES users(id),
      customer_id            INTEGER REFERENCES customers(id),
      area_id                INTEGER REFERENCES areas(id),
      product_id             INTEGER REFERENCES products(id),
      quantity               INTEGER NOT NULL,
      unit_price             NUMERIC(12,2) NOT NULL,
      total_amount           NUMERIC(12,2) NOT NULL,
      status                 TEXT DEFAULT 'pending',
      ordered_at             TIMESTAMPTZ DEFAULT NOW(),
      delivered_at           TIMESTAMPTZ,
      paid_amount            NUMERIC(12,2) DEFAULT 0,
      due_amount             NUMERIC(12,2) DEFAULT 0,
      promised_payment_date  DATE,
      payment_method         TEXT,
      cancellation_reason    TEXT,
      note                   TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS payments (
      id                     SERIAL PRIMARY KEY,
      partner_id             INTEGER REFERENCES users(id),
      customer_id            INTEGER REFERENCES customers(id),
      order_id               INTEGER REFERENCES orders(id),
      amount                 NUMERIC(12,2) NOT NULL,
      payment_method         TEXT,
      paid_at                TIMESTAMPTZ DEFAULT NOW(),
      promised_payment_date  DATE,
      note                   TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS returns (
      id           SERIAL PRIMARY KEY,
      partner_id   INTEGER REFERENCES users(id),
      order_id     INTEGER REFERENCES orders(id),
      customer_id  INTEGER REFERENCES customers(id),
      product_id   INTEGER REFERENCES products(id),
      quantity     INTEGER NOT NULL,
      reason       TEXT,
      returned_at  DATE DEFAULT CURRENT_DATE,
      note         TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id              SERIAL PRIMARY KEY,
      partner_id      INTEGER REFERENCES users(id),
      area_id         INTEGER REFERENCES areas(id),
      category_id     INTEGER REFERENCES expense_categories(id),
      amount          NUMERIC(12,2) NOT NULL,
      payment_method  TEXT,
      description     TEXT,
      date            DATE DEFAULT CURRENT_DATE,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Add product_id to expenses and backfill existing rows to product 5
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id)`;
  await sql`UPDATE expenses SET product_id = 5 WHERE product_id IS NULL`;

  await sql`
    CREATE TABLE IF NOT EXISTS cash_remittances (
      id               SERIAL PRIMARY KEY,
      partner_id       INTEGER REFERENCES users(id),
      amount           NUMERIC(12,2) NOT NULL,
      payment_method   TEXT,
      submitted_at     TIMESTAMPTZ DEFAULT NOW(),
      note             TEXT,
      status           TEXT DEFAULT 'pending',
      acknowledged_by  INTEGER REFERENCES users(id),
      acknowledged_at  TIMESTAMPTZ,
      admin_note       TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS partner_loans (
      id          SERIAL PRIMARY KEY,
      partner_id  INTEGER REFERENCES users(id),
      amount      NUMERIC(12,2) NOT NULL,
      reason      TEXT,
      source_id   INTEGER REFERENCES purchase_requests(id),
      loaned_at   DATE DEFAULT CURRENT_DATE,
      status      TEXT DEFAULT 'outstanding',
      note        TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS loan_repayments (
      id        SERIAL PRIMARY KEY,
      loan_id   INTEGER REFERENCES partner_loans(id) ON DELETE CASCADE,
      amount    NUMERIC(12,2) NOT NULL,
      method    TEXT,
      repaid_at TIMESTAMPTZ DEFAULT NOW(),
      note      TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS attendance_logs (
      id             SERIAL PRIMARY KEY,
      partner_id     INTEGER REFERENCES users(id),
      activity       TEXT NOT NULL,
      punched_at     TIMESTAMPTZ NOT NULL,
      note           TEXT,
      location       TEXT,
      is_corrected   BOOLEAN DEFAULT false,
      original_time  TIMESTAMPTZ,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id                  SERIAL PRIMARY KEY,
      assigned_to         INTEGER REFERENCES users(id),
      created_by          INTEGER REFERENCES users(id),
      is_self_task        BOOLEAN DEFAULT false,
      title               TEXT NOT NULL,
      description         TEXT,
      due_date            DATE,
      priority            TEXT DEFAULT 'normal',
      type                TEXT DEFAULT 'one_time',
      status              TEXT DEFAULT 'pending',
      completed_at        TIMESTAMPTZ,
      note                TEXT,
      recurring_parent_id INTEGER REFERENCES tasks(id),
      created_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_reports (
      id              SERIAL PRIMARY KEY,
      partner_id      INTEGER REFERENCES users(id),
      report_date     DATE NOT NULL,
      status          TEXT DEFAULT 'draft',
      eggs_delivered  INTEGER DEFAULT 0,
      cash_collected  NUMERIC(12,2) DEFAULT 0,
      due_added       NUMERIC(12,2) DEFAULT 0,
      eggs_returned   INTEGER DEFAULT 0,
      total_expenses  NUMERIC(12,2) DEFAULT 0,
      member_note     TEXT,
      submitted_at    TIMESTAMPTZ,
      reviewed_by     INTEGER REFERENCES users(id),
      reviewed_at     TIMESTAMPTZ,
      admin_note      TEXT,
      UNIQUE (partner_id, report_date)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_report_customers (
      id             SERIAL PRIMARY KEY,
      report_id      INTEGER REFERENCES daily_reports(id) ON DELETE CASCADE,
      customer_id    INTEGER REFERENCES customers(id),
      delivered_qty  INTEGER DEFAULT 0,
      charged        NUMERIC(12,2) DEFAULT 0,
      collected      NUMERIC(12,2) DEFAULT 0,
      due_balance    NUMERIC(12,2) DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id          SERIAL PRIMARY KEY,
      product_id  INTEGER NOT NULL REFERENCES products(id),
      quantity    INTEGER NOT NULL,
      reason      TEXT    NOT NULL,
      date        DATE    NOT NULL,
      note        TEXT,
      created_by  INTEGER REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_assets (
      id          SERIAL PRIMARY KEY,
      product_id  INTEGER NOT NULL REFERENCES products(id),
      name        TEXT    NOT NULL,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS purchase_request_assets (
      id                  SERIAL PRIMARY KEY,
      purchase_request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
      asset_id            INTEGER NOT NULL REFERENCES product_assets(id) ON DELETE CASCADE,
      quantity            INTEGER NOT NULL CHECK (quantity > 0),
      created_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS order_assets (
      id         SERIAL PRIMARY KEY,
      order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      asset_id   INTEGER NOT NULL REFERENCES product_assets(id) ON DELETE CASCADE,
      quantity   INTEGER NOT NULL CHECK (quantity > 0),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS order_asset_returns (
      id          SERIAL PRIMARY KEY,
      order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      asset_id    INTEGER NOT NULL REFERENCES product_assets(id) ON DELETE CASCADE,
      quantity    INTEGER NOT NULL CHECK (quantity > 0),
      returned_at DATE    NOT NULL,
      note        TEXT,
      created_by  INTEGER REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS supplier_asset_returns (
      id          SERIAL PRIMARY KEY,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      asset_id    INTEGER NOT NULL REFERENCES product_assets(id) ON DELETE CASCADE,
      quantity    INTEGER NOT NULL CHECK (quantity > 0),
      returned_at DATE    NOT NULL,
      note        TEXT,
      created_by  INTEGER REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Add customer_type column if missing
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type TEXT`;

  // Migrate legacy role 'user' → 'partner'
  await sql`UPDATE users SET role = 'partner' WHERE role = 'user'`;

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
