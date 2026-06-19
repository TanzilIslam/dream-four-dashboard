# Dream Four Dashboard — Technical Implementation Guide

---

## Part 1: Backend

### 1.0 Database Migration (Full Schema)

All tables created/updated via `/api/setup`. Run once on deploy.

```sql
-- Extend existing users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]';

-- Suppliers / Farms
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
);

-- Areas / Territories
CREATE TABLE IF NOT EXISTS areas (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Partner ↔ Area (many-to-many)
CREATE TABLE IF NOT EXISTS user_areas (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  area_id     INTEGER REFERENCES areas(id) ON DELETE CASCADE,
  is_active   BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, area_id)
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  unit                 TEXT NOT NULL DEFAULT 'piece',
  default_price        NUMERIC(12,2),
  low_stock_threshold  INTEGER DEFAULT 100,
  is_active            BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Pricing Tiers (per product)
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  unit_price  NUMERIC(12,2) NOT NULL,
  min_qty     INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  icon       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Global Payment / System Settings (single row, id=1)
CREATE TABLE IF NOT EXISTS payment_settings (
  id                    SERIAL PRIMARY KEY,
  due_allowed           BOOLEAN DEFAULT true,
  max_due_per_customer  NUMERIC(12,2) DEFAULT 1000,
  late_punch_threshold  TIME DEFAULT '09:30',
  low_stock_default     INTEGER DEFAULT 100,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO payment_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Customers
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
);

-- Purchase Requests (admin approval required before buying)
CREATE TABLE IF NOT EXISTS purchase_requests (
  id               SERIAL PRIMARY KEY,
  partner_id       INTEGER REFERENCES users(id),
  supplier_id      INTEGER REFERENCES suppliers(id),
  product_id       INTEGER REFERENCES products(id),
  requested_qty    INTEGER NOT NULL,
  estimated_price  NUMERIC(12,2),
  estimated_total  NUMERIC(12,2),
  status           TEXT DEFAULT 'pending',  -- pending/approved/rejected/completed
  admin_note       TEXT,
  approved_by      INTEGER REFERENCES users(id),
  approved_at      TIMESTAMPTZ,
  actual_qty       INTEGER,
  actual_price     NUMERIC(12,2),
  actual_total     NUMERIC(12,2),
  purchased_at     DATE,
  payment_method   TEXT,                    -- cash/bank/bkash/nagad
  from_personal    BOOLEAN DEFAULT false,
  note             TEXT,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Orders (customer order → stock reserved → delivered or cancelled)
CREATE TABLE IF NOT EXISTS orders (
  id                     SERIAL PRIMARY KEY,
  partner_id             INTEGER REFERENCES users(id),
  customer_id            INTEGER REFERENCES customers(id),
  area_id                INTEGER REFERENCES areas(id),
  product_id             INTEGER REFERENCES products(id),
  quantity               INTEGER NOT NULL,
  unit_price             NUMERIC(12,2) NOT NULL,
  total_amount           NUMERIC(12,2) NOT NULL,
  status                 TEXT DEFAULT 'pending',  -- pending/delivered/cancelled
  ordered_at             TIMESTAMPTZ DEFAULT NOW(),
  delivered_at           TIMESTAMPTZ,
  paid_amount            NUMERIC(12,2) DEFAULT 0,
  due_amount             NUMERIC(12,2) DEFAULT 0,
  promised_payment_date  DATE,
  payment_method         TEXT,
  cancellation_reason    TEXT,
  note                   TEXT
);

-- Payments / Due Collections (separate from delivery payment)
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
);

-- Returns (restores central stock)
CREATE TABLE IF NOT EXISTS returns (
  id           SERIAL PRIMARY KEY,
  partner_id   INTEGER REFERENCES users(id),
  order_id     INTEGER REFERENCES orders(id),
  customer_id  INTEGER REFERENCES customers(id),
  product_id   INTEGER REFERENCES products(id),
  quantity     INTEGER NOT NULL,
  reason       TEXT,  -- not_home/damaged/order_cancelled/other
  returned_at  DATE DEFAULT CURRENT_DATE,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses
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
);

-- Cash Remittances (partner → business, admin acknowledges)
CREATE TABLE IF NOT EXISTS cash_remittances (
  id               SERIAL PRIMARY KEY,
  partner_id       INTEGER REFERENCES users(id),
  amount           NUMERIC(12,2) NOT NULL,
  payment_method   TEXT,
  submitted_at     TIMESTAMPTZ DEFAULT NOW(),
  note             TEXT,
  status           TEXT DEFAULT 'pending',  -- pending/acknowledged
  acknowledged_by  INTEGER REFERENCES users(id),
  acknowledged_at  TIMESTAMPTZ,
  admin_note       TEXT
);

-- Partner Loans (personal investment as business loan)
CREATE TABLE IF NOT EXISTS partner_loans (
  id          SERIAL PRIMARY KEY,
  partner_id  INTEGER REFERENCES users(id),
  amount      NUMERIC(12,2) NOT NULL,
  reason      TEXT,
  source_id   INTEGER REFERENCES purchase_requests(id),
  loaned_at   DATE DEFAULT CURRENT_DATE,
  status      TEXT DEFAULT 'outstanding',  -- outstanding/partially_repaid/repaid
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Loan Repayments
CREATE TABLE IF NOT EXISTS loan_repayments (
  id        SERIAL PRIMARY KEY,
  loan_id   INTEGER REFERENCES partner_loans(id) ON DELETE CASCADE,
  amount    NUMERIC(12,2) NOT NULL,
  method    TEXT,
  repaid_at TIMESTAMPTZ DEFAULT NOW(),
  note      TEXT
);

-- Attendance Logs
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
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id                  SERIAL PRIMARY KEY,
  assigned_to         INTEGER REFERENCES users(id),
  created_by          INTEGER REFERENCES users(id),
  is_self_task        BOOLEAN DEFAULT false,
  title               TEXT NOT NULL,
  description         TEXT,
  due_date            DATE,
  priority            TEXT DEFAULT 'normal',    -- low/normal/high/urgent
  type                TEXT DEFAULT 'one_time',  -- one_time/daily_recurring
  status              TEXT DEFAULT 'pending',   -- pending/in_progress/completed/missed
  completed_at        TIMESTAMPTZ,
  note                TEXT,
  recurring_parent_id INTEGER REFERENCES tasks(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Reports
CREATE TABLE IF NOT EXISTS daily_reports (
  id              SERIAL PRIMARY KEY,
  partner_id      INTEGER REFERENCES users(id),
  report_date     DATE NOT NULL,
  status          TEXT DEFAULT 'draft',  -- draft/submitted/reviewed
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
);

-- Daily Report Customer Snapshot
CREATE TABLE IF NOT EXISTS daily_report_customers (
  id             SERIAL PRIMARY KEY,
  report_id      INTEGER REFERENCES daily_reports(id) ON DELETE CASCADE,
  customer_id    INTEGER REFERENCES customers(id),
  delivered_qty  INTEGER DEFAULT 0,
  charged        NUMERIC(12,2) DEFAULT 0,
  collected      NUMERIC(12,2) DEFAULT 0,
  due_balance    NUMERIC(12,2) DEFAULT 0
);
```

---

### 1.1 Auth Middleware Rules

All API routes must check session. Apply these rules consistently:

| Role    | Can access                                                         |
|---------|--------------------------------------------------------------------|
| admin   | All routes                                                         |
| partner | Own records only (filter by `partner_id = session.user.id`)        |

Helper pattern in every route:
```ts
const session = await getIronSession<AppSession>(req, res, sessionOptions);
if (!session.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
const isAdmin = session.user.role === "admin";
const partnerId = session.user.id;
```

---

### Module 1 — Suppliers

**File:** `app/api/settings/suppliers/route.ts`
**File:** `app/api/settings/suppliers/[id]/route.ts`
**Auth:** admin only (all methods)
**Schema:** `lib/schemas/supplier.ts`

| Method | Path                          | Action                      |
|--------|-------------------------------|-----------------------------|
| GET    | /api/settings/suppliers       | List all (active by default)|
| POST   | /api/settings/suppliers       | Create                      |
| PUT    | /api/settings/suppliers/[id]  | Update                      |
| DELETE | /api/settings/suppliers/[id]  | Soft delete (is_active=false)|

**Zod fields:** name(required), contact_person, phone, whatsapp, email, address, area, bank_name, bank_account, bkash, nagad, default_price, notes, is_active

---

### Module 2 — Areas

**File:** `app/api/settings/areas/route.ts`
**File:** `app/api/settings/areas/[id]/route.ts`
**File:** `app/api/settings/areas/[id]/members/route.ts`
**Auth:** admin only

| Method | Path                                  | Action                                    |
|--------|---------------------------------------|-------------------------------------------|
| GET    | /api/settings/areas                   | List all areas with assigned partner name |
| POST   | /api/settings/areas                   | Create area                               |
| PUT    | /api/settings/areas/[id]              | Update area                               |
| DELETE | /api/settings/areas/[id]              | Soft delete                               |
| GET    | /api/settings/areas/[id]/members      | List assigned partners for area           |
| POST   | /api/settings/areas/[id]/members      | Assign partner { user_id }                |
| DELETE | /api/settings/areas/[id]/members/[uid]| Remove assignment (set is_active=false)   |

**Business logic:**
- On assign: check if area already has an active partner. If yes, deactivate old assignment first.
- GET areas list should include: `assigned_partner_name` (JOIN users via user_areas WHERE is_active=true)

**Zod fields:** name(required), description, is_active

---

### Module 3 — Products

**File:** `app/api/settings/products/route.ts`
**File:** `app/api/settings/products/[id]/route.ts`
**Auth:** admin only

| Method | Path                         | Action       |
|--------|------------------------------|--------------|
| GET    | /api/settings/products       | List all     |
| POST   | /api/settings/products       | Create       |
| PUT    | /api/settings/products/[id]  | Update       |
| DELETE | /api/settings/products/[id]  | Soft delete  |

**Zod fields:** name(required), unit(required), default_price, low_stock_threshold, is_active

---

### Module 4 — Pricing Tiers

**File:** `app/api/settings/pricing-tiers/route.ts`
**File:** `app/api/settings/pricing-tiers/[id]/route.ts`
**Auth:** admin only

| Method | Path                              | Action                          |
|--------|-----------------------------------|---------------------------------|
| GET    | /api/settings/pricing-tiers       | List all (optionally ?product_id)|
| POST   | /api/settings/pricing-tiers       | Create                          |
| PUT    | /api/settings/pricing-tiers/[id]  | Update                          |
| DELETE | /api/settings/pricing-tiers/[id]  | Delete                          |

**Zod fields:** product_id(required), name(required), unit_price(required), min_qty

---

### Module 5 — Expense Categories

**File:** `app/api/settings/expense-categories/route.ts`
**File:** `app/api/settings/expense-categories/[id]/route.ts`
**Auth:** admin only

| Method | Path                                    | Action      |
|--------|-----------------------------------------|-------------|
| GET    | /api/settings/expense-categories        | List all    |
| POST   | /api/settings/expense-categories        | Create      |
| PUT    | /api/settings/expense-categories/[id]   | Update      |
| DELETE | /api/settings/expense-categories/[id]   | Delete      |

**Zod fields:** name(required), icon

---

### Module 6 — Payment Config

**File:** `app/api/settings/payment-config/route.ts`
**Auth:** admin only

| Method | Path                          | Action               |
|--------|-------------------------------|----------------------|
| GET    | /api/settings/payment-config  | Get single row (id=1)|
| PUT    | /api/settings/payment-config  | Update single row    |

**Zod fields:** due_allowed, max_due_per_customer, late_punch_threshold, low_stock_default

---

### Module 7 — Customers

**File:** `app/api/customers/route.ts`
**File:** `app/api/customers/[id]/route.ts`
**File:** `app/api/customers/[id]/pause/route.ts`
**Auth:** partner = own only; admin = all

| Method | Path                         | Action                                    |
|--------|------------------------------|-------------------------------------------|
| GET    | /api/customers               | List (partner: own; admin: all or ?partner_id)|
| POST   | /api/customers               | Create (partner_id from session)          |
| GET    | /api/customers/[id]          | Single + outstanding due computed         |
| PUT    | /api/customers/[id]          | Update                                    |
| DELETE | /api/customers/[id]          | Soft delete (is_active=false)             |
| POST   | /api/customers/[id]/pause    | Pause { pause_until?, pause_reason }      |
| POST   | /api/customers/[id]/unpause  | Resume (clear pause fields)               |

**Business logic:**
- GET single: compute `outstanding_due` = delivered total − paid total − payments total
- Response includes: customer fields + `outstanding_due` + `next_delivery_date` (computed)
- `next_delivery_date` = MAX(orders.delivered_at) + delivery_interval (null if no deliveries)

**Zod fields:** area_id(required), name(required), phone, whatsapp, address, pricing_tier_id, due_allowed, max_due, delivery_frequency, delivery_interval, is_paused, pause_start, pause_until, pause_reason, notes

---

### Module 8 — Purchase Requests

**File:** `app/api/purchase-requests/route.ts`
**File:** `app/api/purchase-requests/[id]/route.ts`
**File:** `app/api/purchase-requests/[id]/approve/route.ts`
**File:** `app/api/purchase-requests/[id]/reject/route.ts`
**File:** `app/api/purchase-requests/[id]/complete/route.ts`

| Method | Path                                    | Auth    | Action                                     |
|--------|-----------------------------------------|---------|--------------------------------------------|
| GET    | /api/purchase-requests                  | both    | List (partner: own; admin: all)            |
| POST   | /api/purchase-requests                  | partner | Create request (status=pending)            |
| GET    | /api/purchase-requests/[id]             | both    | Single request                             |
| POST   | /api/purchase-requests/[id]/approve     | admin   | Approve { admin_note? }                    |
| POST   | /api/purchase-requests/[id]/reject      | admin   | Reject { admin_note }                      |
| POST   | /api/purchase-requests/[id]/complete    | partner | Record actuals { actual_qty, actual_price, purchased_at, payment_method, from_personal, note } |

**Business logic on complete:**
1. Set status = completed, actual_total = actual_qty × actual_price
2. Add actual_qty to central stock pool (stock is computed, not stored — no action needed; query will include it)
3. If from_personal = true → INSERT into partner_loans (amount=actual_total, source_id=request.id)

**Zod fields (create):** supplier_id(required), product_id(required), requested_qty(required), estimated_price(required), note
**Zod fields (complete):** actual_qty(required), actual_price(required), purchased_at(required), payment_method(required), from_personal, note

---

### Module 9 — Orders

**File:** `app/api/orders/route.ts`
**File:** `app/api/orders/[id]/route.ts`
**File:** `app/api/orders/[id]/deliver/route.ts`
**File:** `app/api/orders/[id]/cancel/route.ts`

| Method | Path                        | Auth    | Action                                            |
|--------|-----------------------------|---------|---------------------------------------------------|
| GET    | /api/orders                 | both    | List (partner: own; admin: all; filter: ?date, ?customer_id, ?status) |
| POST   | /api/orders                 | partner | Create order (reserve stock, check due limit)     |
| GET    | /api/orders/[id]            | both    | Single order                                      |
| POST   | /api/orders/[id]/deliver    | partner | Mark delivered + record payment                   |
| POST   | /api/orders/[id]/cancel     | partner | Cancel + release reserved stock                   |

**Business logic on create:**
1. Compute customer outstanding due
2. If due ≥ customer.max_due → return 422 with `{ error: "Due limit exceeded", current_due: X, max_due: Y }`
3. Check available stock: `purchased_completed − delivered − pending_orders ≥ requested_qty`
4. If insufficient stock → return 422 with `{ error: "Insufficient stock", available: X }`
5. Insert order (status=pending) — stock is now reserved (pending count increases)

**Business logic on deliver:**
- Body: `{ paid_amount, payment_method, promised_payment_date? }`
- Set status=delivered, delivered_at=NOW(), due_amount = total_amount − paid_amount

**Business logic on cancel:**
- Body: `{ cancellation_reason }`
- Set status=cancelled — reserved stock automatically released (pending count decreases)

**Zod fields (create):** customer_id(required), product_id(required), quantity(required, min 1), unit_price(required), note
**Zod fields (deliver):** paid_amount(required, ≥0), payment_method(required), promised_payment_date(if paid_amount < total_amount)
**Zod fields (cancel):** cancellation_reason(required)

---

### Module 10 — Returns

**File:** `app/api/returns/route.ts`
**File:** `app/api/returns/[id]/route.ts`

| Method | Path            | Auth    | Action                          |
|--------|-----------------|---------|---------------------------------|
| GET    | /api/returns    | both    | List (partner: own; admin: all) |
| POST   | /api/returns    | partner | Create return                   |
| DELETE | /api/returns/[id] | partner | Delete (same day only)        |

**Business logic:** Returned qty counted in stock formula automatically (no extra step needed).

**Zod fields:** order_id, customer_id(required), product_id(required), quantity(required), reason(required), returned_at, note

---

### Module 11 — Payments (Due Collections)

**File:** `app/api/payments/route.ts`
**File:** `app/api/payments/[id]/route.ts`

| Method | Path              | Auth    | Action                          |
|--------|--------------------|---------|----------------------------------|
| GET    | /api/payments      | both    | List (partner: own; admin: all) |
| POST   | /api/payments      | partner | Record due collection           |
| DELETE | /api/payments/[id] | partner | Delete (same day only)          |

**Zod fields:** customer_id(required), order_id, amount(required, >0), payment_method(required), promised_payment_date, note

---

### Module 12 — Expenses

**File:** `app/api/expenses/route.ts`
**File:** `app/api/expenses/[id]/route.ts`

| Method | Path               | Auth    | Action                          |
|--------|--------------------|---------|----------------------------------|
| GET    | /api/expenses      | both    | List (partner: own; admin: all) |
| POST   | /api/expenses      | partner | Create expense                  |
| PUT    | /api/expenses/[id] | partner | Edit (same day only)            |
| DELETE | /api/expenses/[id] | partner | Delete (same day only)          |

**Zod fields:** area_id, category_id(required), amount(required, >0), payment_method(required), description(required), date

---

### Module 13 — Cash Remittances

**File:** `app/api/remittances/route.ts`
**File:** `app/api/remittances/[id]/route.ts`
**File:** `app/api/remittances/[id]/acknowledge/route.ts`

| Method | Path                                | Auth    | Action                                        |
|--------|-------------------------------------|---------|-----------------------------------------------|
| GET    | /api/remittances                    | both    | Partner: own; Admin: all (filter ?status)     |
| POST   | /api/remittances                    | partner | Submit remittance (status=pending)            |
| POST   | /api/remittances/[id]/acknowledge   | admin   | Acknowledge { admin_note? }                   |

**Zod fields (submit):** amount(required, >0), payment_method(required), note
**Zod fields (acknowledge):** admin_note

---

### Module 14 — Partner Loans

**File:** `app/api/loans/route.ts`
**File:** `app/api/loans/[id]/route.ts`
**File:** `app/api/loans/[id]/repay/route.ts`

| Method | Path                     | Auth  | Action                                         |
|--------|--------------------------|-------|------------------------------------------------|
| GET    | /api/loans               | both  | Partner: own; Admin: all                       |
| POST   | /api/loans               | both  | Manual loan creation (admin for any, partner for self) |
| POST   | /api/loans/[id]/repay    | admin | Add repayment { amount, method, note }         |

**Business logic:**
- After repayment: recalculate loan status (outstanding/partially_repaid/repaid)
- Auto-created loans come from purchase_requests/complete — no manual creation needed there

**Zod fields (loan):** partner_id(admin only), amount(required), reason, loaned_at, note
**Zod fields (repay):** amount(required), method(required), note

---

### Module 15 — Attendance

**File:** `app/api/attendance/route.ts`
**File:** `app/api/attendance/[id]/route.ts`

| Method | Path                   | Auth    | Action                                                |
|--------|------------------------|---------|-------------------------------------------------------|
| GET    | /api/attendance        | both    | Partner: own (default today); Admin: all (?date, ?partner_id) |
| POST   | /api/attendance        | partner | Punch activity { activity, note?, location? }         |
| PUT    | /api/attendance/[id]   | partner | Self-correct { punched_at } — sets is_corrected=true, saves original_time |

**Computed fields on GET (admin daily view):**
```
punch_in, punch_out, total_minutes, lunch_minutes, net_minutes, is_late, is_absent
```

**Zod fields (punch):** activity(required, enum), note, location
**Zod fields (correct):** punched_at(required, datetime)

---

### Module 16 — Tasks

**File:** `app/api/tasks/route.ts`
**File:** `app/api/tasks/[id]/route.ts`
**File:** `app/api/tasks/[id]/status/route.ts`

| Method | Path                     | Auth    | Action                                                        |
|--------|--------------------------|---------|---------------------------------------------------------------|
| GET    | /api/tasks               | both    | Partner: own tasks; Admin: all (?date, ?partner_id, ?status)  |
| POST   | /api/tasks               | both    | Admin: assign to anyone; Partner: self-task only (is_self_task=true) |
| PUT    | /api/tasks/[id]          | admin   | Edit task details                                             |
| DELETE | /api/tasks/[id]          | admin   | Delete task                                                   |
| POST   | /api/tasks/[id]/status   | partner | Update status + note { status, note? }                        |

**Business logic — recurring tasks:**
- When creating with type=daily_recurring, a cron-style check runs on GET:
  if today's instance doesn't exist for a recurring task → auto-generate it
  (alternative: generate on first GET of the day via a helper function)

**Zod fields (create):** assigned_to(required), title(required), description, due_date, priority, type, is_self_task
**Zod fields (status):** status(required, enum), note

---

### Module 17 — Daily Reports

**File:** `app/api/daily-reports/route.ts`
**File:** `app/api/daily-reports/preview/route.ts`
**File:** `app/api/daily-reports/[id]/route.ts`
**File:** `app/api/daily-reports/[id]/submit/route.ts`
**File:** `app/api/daily-reports/[id]/review/route.ts`

| Method | Path                              | Auth    | Action                                           |
|--------|-----------------------------------|---------|--------------------------------------------------|
| GET    | /api/daily-reports                | both    | Partner: own list; Admin: all (?date)            |
| GET    | /api/daily-reports/preview        | partner | Auto-build report for ?date from actual data     |
| GET    | /api/daily-reports/[id]           | both    | Single report with customer snapshot             |
| POST   | /api/daily-reports/[id]/submit    | partner | Submit { member_note } — saves snapshot          |
| POST   | /api/daily-reports/[id]/review    | admin   | Mark reviewed { admin_note }                     |

**Business logic on preview:**
```
eggs_delivered  = SUM(orders.quantity WHERE status=delivered AND partner_id=X AND date=Y)
cash_collected  = SUM(orders.paid_amount WHERE delivered AND date=Y) + SUM(payments WHERE date=Y)
due_added       = SUM(orders.due_amount WHERE delivered AND date=Y)
eggs_returned   = SUM(returns.quantity WHERE date=Y)
total_expenses  = SUM(expenses.amount WHERE date=Y)
customers:      per-customer due balance snapshot
```

**Business logic on submit:**
1. Upsert daily_report row (status=submitted, submitted_at=NOW())
2. Compute and INSERT daily_report_customers snapshot
3. If report already submitted → reject (cannot re-submit)

---

### Modules 18–28 — Analytics & Reports (Read-only APIs)

These are aggregation-only GET endpoints. No mutations.

| Path                          | Description                                                       |
|-------------------------------|-------------------------------------------------------------------|
| GET /api/analytics/overview   | Admin daily pulse — orders, cash, due, expenses today vs yday     |
| GET /api/analytics/stock      | Central stock per product (purchased/delivered/reserved/available)|
| GET /api/analytics/partners   | Per partner today: orders, sold, collected, due, expenses         |
| GET /api/analytics/reminders  | Delivery + payment due reminders (partner: own; admin: all)       |
| GET /api/analytics/attendance | Today's attendance summary (admin: all partners)                  |
| GET /api/analytics/due        | All customers with outstanding due, filter by partner/area        |
| GET /api/analytics/investment | All completed purchase_requests ledger                            |
| GET /api/analytics/expenses   | All expenses ledger, filter by partner/area/category/date         |
| GET /api/analytics/cashflow   | Per partner: invested, expenses, collected, in-hand, remitted     |
| GET /api/analytics/loans      | All loans + repayments + outstanding                              |
| GET /api/analytics/pnl        | Period P&L: revenue, cost, expenses, net, shares                  |
| GET /api/analytics/area       | Sales, revenue, due per area                                      |
| GET /api/analytics/supplier   | Purchase history per supplier                                     |

All accept query params: `?from=YYYY-MM-DD&to=YYYY-MM-DD` (default: current month)

---

---

## Part 2: Frontend

### Nav Structure

```
/dashboard/
├── overview                  → Admin daily dashboard
├── settings/
│   ├── suppliers             → Step 1
│   ├── areas                 → Step 2
│   ├── products              → Step 3
│   ├── pricing-tiers         → Step 4
│   ├── expense-categories    → Step 5
│   └── payment-config        → Step 6
├── customers                 → Step 7
├── purchase-requests         → Step 8
├── orders                    → Step 9
├── returns                   → Step 10
├── payments                  → Step 11
├── expenses                  → Step 12
├── remittances               → Step 13
├── loans                     → Step 14
├── attendance                → Step 15
├── tasks                     → Step 16
├── daily-report              → Step 17
├── reports/
│   ├── due                   → Step 24
│   ├── stock                 → Step 25 (part of overview)
│   ├── attendance            → Step 25
│   ├── loans                 → Step 26
│   ├── area                  → Step 27
│   ├── partner-pl            → Step 27
│   └── settlement            → Step 28
└── profile                   → existing
```

**Sidebar sections (add to layout.tsx):**
```
Overview
── Overview

Operations
── Customers
── Orders
── Purchase Requests
── Payments
── Returns
── Expenses
── Remittances
── Loans

Attendance & Tasks
── Attendance
── Tasks
── Daily Report

Reports (admin only)
── Due Report
── Attendance Report
── Loans Report
── Area Report
── Partner P&L
── Profit Settlement

Settings (admin only)
── Suppliers
── Areas
── Products
── Pricing Tiers
── Expense Categories
── Payment Config
```

---

### Module 1 — Suppliers Page

**Route:** `/dashboard/settings/suppliers`
**Auth:** admin only (redirect partners away)
**Components:** Table + right Sheet form

**Table columns:** Name, Contact, Phone, bKash, Default Price, Active, Actions (Edit, Deactivate)
**Sheet form fields:**
- Name* (Input)
- Contact Person (Input)
- Phone (Input), WhatsApp (Input)
- Email (Input)
- Address (Textarea)
- Area (Input — farm region)
- Bank Name (Input), Bank Account (Input)
- bKash (Input), Nagad (Input)
- Default Price (Input number)
- Notes (Textarea)
- Is Active (Switch)

**Behavior:** Deactivate = soft delete (not permanent). Show active by default; toggle to show all.

---

### Module 2 — Areas Page

**Route:** `/dashboard/settings/areas`
**Auth:** admin only
**Components:** Table + Sheet form + inline partner assignment panel

**Table columns:** Name, Description, Assigned Partner, Active, Actions
**Sheet form fields:** Name*, Description, Is Active

**Partner Assignment (below form or separate tab in sheet):**
- Shows list of active partners (users with role=partner)
- Select partner → assign to this area
- Current assignment shown with "Remove" button
- Warning if area already has an active partner (will replace)

---

### Module 3 — Products Page

**Route:** `/dashboard/settings/products`
**Auth:** admin only
**Table columns:** Name, Unit, Default Price, Low Stock Threshold, Active, Actions
**Form fields:** Name*, Unit*, Default Price, Low Stock Threshold, Is Active

---

### Module 4 — Pricing Tiers Page

**Route:** `/dashboard/settings/pricing-tiers`
**Auth:** admin only
**Table columns:** Product, Tier Name, Unit Price, Min Qty, Actions
**Filter:** Product dropdown at top of page
**Form fields:** Product* (Select), Tier Name*, Unit Price*, Min Qty

---

### Module 5 — Expense Categories Page

**Route:** `/dashboard/settings/expense-categories`
**Auth:** admin only
**Table columns:** Icon, Name, Actions
**Form fields:** Name*, Icon (Input — emoji or short label)

---

### Module 6 — Payment Config Page

**Route:** `/dashboard/settings/payment-config`
**Auth:** admin only
**Layout:** Single card form (no table — single row config)
**Form fields:**
- Due Allowed (Switch)
- Max Due Per Customer (Input number, ৳)
- Late Punch Threshold (Input time, e.g. "09:30")
- Low Stock Default (Input number)
- Save button

---

### Module 7 — Customers Page

**Route:** `/dashboard/customers`
**Auth:** partner (own) + admin (all, with partner filter)
**Table columns:** Name, Area, Phone, Delivery Schedule, Outstanding Due, Next Delivery, Status (Paused badge), Actions
**Form fields:**
- Area* (Select — partner only sees their assigned areas)
- Name*, Phone, WhatsApp, Address (Textarea)
- Pricing Tier (Select)
- Due Allowed (Switch), Max Due (Input, shown if due_allowed=true)
- Delivery Frequency (Select: daily/every_2_days/weekly/custom)
- Delivery Interval (Input number, shown if custom)
- Notes (Textarea)

**Pause action:**
- Action button "Pause" opens a small dialog
- Fields: Pause Until (DatePicker, optional), Pause Reason
- "Resume" button shown on paused customers

**Outstanding Due:** shown as colored badge (green=0, yellow=mid, red=near/over limit)

---

### Module 8 — Purchase Requests Page

**Route:** `/dashboard/purchase-requests`
**Auth:** partner (own) + admin (all)

**Two views:**

**Partner view:**
- Table: Supplier, Product, Requested Qty, Estimated Total, Status badge, Date, Actions
- Status badges: Pending (yellow), Approved (green), Rejected (red), Completed (gray)
- "New Request" button → Sheet form
- On Approved row: "Mark as Purchased" button → opens Complete sheet
- Complete sheet fields: Actual Qty*, Actual Price*, Purchase Date*, Payment Method*, From Personal (Switch), Note

**Admin view:**
- Same table + partner name column
- On Pending row: "Approve" / "Reject" buttons → small dialog with note field
- Approve dialog: optional note → confirm
- Reject dialog: required note → confirm

**Form fields (create):** Supplier* (Select), Product* (Select), Requested Qty*, Estimated Price*, Note

---

### Module 9 — Orders Page

**Route:** `/dashboard/orders`
**Auth:** partner (own) + admin (all)

**Table columns:** Customer, Area, Product, Qty, Total, Paid, Due, Status badge, Order Date, Actions
**Filter bar:** Status (All/Pending/Delivered/Cancelled), Date range, Customer search

**New Order button → Sheet form:**
- Customer* (searchable Select — shows only active, non-paused, within due limit)
- Product* (Select)
- Qty*, Unit Price* (auto-filled from customer's pricing tier, editable)
- Total (computed, read-only)
- Note

**Pending row actions:**
- "Deliver" button → dialog: Paid Amount (Input), Payment Method (Select), Promised Date (DatePicker, shown if paid < total)
- "Cancel" button → dialog: Cancellation Reason (required)

**Due limit warning:** If customer is blocked (due ≥ max_due), show alert instead of form. Prompt to collect payment first.

---

### Module 10 — Returns Page

**Route:** `/dashboard/returns`
**Auth:** partner (own) + admin (all)
**Table columns:** Customer, Product, Qty, Reason, Date, Linked Order, Note, Actions
**Form fields:** Customer* (Select), Product* (Select), Qty*, Reason* (Select), Returned At (Date), Linked Order (Select, optional), Note

---

### Module 11 — Payments Page

**Route:** `/dashboard/payments`
**Auth:** partner (own) + admin (all)
**Table columns:** Customer, Amount, Method, Date, Linked Order, Promised Date, Note
**Form fields:** Customer* (Select — shows outstanding due next to name), Amount*, Payment Method*, Linked Order (optional), Promised Payment Date (if partial), Note

---

### Module 12 — Expenses Page

**Route:** `/dashboard/expenses`
**Auth:** partner (own) + admin (all)
**Table columns:** Date, Category, Description, Amount, Method, Area, Actions
**Form fields:** Date (default today), Category* (Select), Description*, Amount*, Payment Method*, Area (Select, optional)

---

### Module 13 — Remittances Page

**Route:** `/dashboard/remittances`
**Auth:** partner (own) + admin (all)

**Partner view:**
- Table: Amount, Method, Date, Status (Pending/Acknowledged), Admin Note
- "Submit Remittance" button → Sheet form: Amount*, Payment Method*, Note

**Admin view:**
- Table + partner column
- Pending rows show "Acknowledge" button → dialog with optional admin note

---

### Module 14 — Loans Page

**Route:** `/dashboard/loans`
**Auth:** partner (own view) + admin (all + repayment actions)

**Table columns:** Partner (admin), Amount, Reason, Date, Repaid, Outstanding, Status badge, Actions

**Admin actions:**
- "Add Repayment" button on each outstanding loan → dialog: Amount*, Method*, Note
- "Create Loan" button (manual loan for any partner)

**Partner view:** Read-only. Can see own loan history and repayment status.

---

### Module 15 — Attendance Page

**Route:** `/dashboard/attendance`

**Partner view — Today's Timeline:**
- Visual timeline showing punched activities in chronological order
- Each event: time, activity label, duration (for paired events)
- Large punch buttons for current valid activity (context-aware: if punched_in but not out for lunch → show "Lunch Break" button)
- "Correct a Punch" link → opens list of today's punches, select one, edit time

**Admin view:**
- Date picker at top (default today)
- Table: Partner, Punch In, Punch Out, Total Hrs, Lunch, Net Hrs, Status (On Time/Late/Absent)
- Click partner row → see their full timeline for that day

---

### Module 16 — Tasks Page

**Route:** `/dashboard/tasks`

**Partner view:**
- Two tabs: "My Tasks Today" | "Upcoming"
- Task card: priority badge, title, description, due date, status
- "Mark Done" button → dialog to add completion note
- "Mark In Progress" button
- Self-tasks: "Add Task" button → simple form (title, description, due_date, priority)

**Admin view:**
- Filter: partner, status, date, priority
- Table: Partner, Task, Priority badge, Type, Due Date, Status badge
- "Assign Task" button → Sheet form: Partner* (Select), Title*, Description, Due Date, Priority, Type (one_time/daily_recurring)

---

### Module 17 — Daily Report Page

**Route:** `/dashboard/daily-report`

**Partner view:**
- Date selector (default today)
- Auto-generated summary cards: Eggs Delivered, Cash Collected, Due Added, Returns, Expenses
- Customer due table (per-customer snapshot)
- "Member Note" textarea
- "Submit Report" button (disabled if already submitted)
- Status badge: Draft / Submitted / Reviewed

**Admin view:**
- List of partners + today's report status
- Unreviewed = orange badge
- Click → view full report → "Mark Reviewed" button + admin note input

---

### Module 20 — Admin Overview (Dashboard Home)

**Route:** `/dashboard/overview`
**Auth:** admin only (partner sees their own summary instead)

**Sections:**
1. Business Pulse cards (4 KPIs: sold, cash, due, expenses — today vs yesterday)
2. Central Stock table (per product)
3. Partner Performance table (today)
4. Pending Actions panel (purchase requests, remittances, reports to review)
5. Outstanding Due summary (total + top 5 customers)
6. Attendance summary table
7. Low stock alerts

**Partner overview (when role=partner):**
- My Tasks Today (count: pending/done)
- Delivery Reminders (call today list)
- Payment Due Today (promised payment list)
- My Stats (today: orders, collected, expenses)
- Quick action buttons: New Order, Punch, Log Expense

---

### Modules 21–28 — Reports Pages

All report pages share the same layout pattern:
- Date range filter at top (Today / This Week / This Month / Custom)
- Summary stat cards
- Detailed data table with export hint

| Route                        | Key Content                                              |
|------------------------------|----------------------------------------------------------|
| /dashboard/reports/due       | Customer due table, filter by partner/area, overdue days |
| /dashboard/reports/stock     | Per product: purchased/delivered/reserved/available      |
| /dashboard/reports/attendance| Daily hours table, late/absent badges, activity breakdown|
| /dashboard/reports/loans     | Loan table, repayments, outstanding per partner          |
| /dashboard/reports/area      | Sales, revenue, due per area                             |
| /dashboard/reports/partner-pl| Per partner: invested, revenue, collected, due, net      |
| /dashboard/reports/settlement| P&L summary, tech share, per-partner payout calculation  |

---

---

## Part 3: Sync Checklist

For each module, check off as completed. Build in order — later modules depend on earlier ones.

| Step | Module                   | DB Table | /api/setup | API Routes | Zod Schema | Page | Form | Tested |
|------|--------------------------|----------|------------|------------|------------|------|------|--------|
| 1    | Suppliers                | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 2    | Areas + Assignment       | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 3    | Products                 | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 4    | Pricing Tiers            | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 5    | Expense Categories       | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 6    | Payment Config           | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 7    | Customers                | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 8    | Purchase Requests        | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 9    | Orders                   | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 10   | Returns                  | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 11   | Payments                 | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 12   | Expenses                 | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 13   | Cash Remittances         | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 14   | Partner Loans            | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 15   | Attendance               | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 16   | Tasks                    | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 17   | Daily Report             | ☐        | ☐          | ☐          | ☐          | ☐    | ☐    | ☐      |
| 18   | Reminders                | —        | —          | ☐          | —          | ☐    | —    | ☐      |
| 19   | Partner Daily Summary    | —        | —          | ☐          | —          | ☐    | —    | ☐      |
| 20   | Admin Overview           | —        | —          | ☐          | —          | ☐    | —    | ☐      |
| 21   | Investment Ledger        | —        | —          | ☐          | —          | ☐    | —    | ☐      |
| 22   | Expense Ledger           | —        | —          | ☐          | —          | ☐    | —    | ☐      |
| 23   | Cash Flow Report         | —        | —          | ☐          | —          | ☐    | —    | ☐      |
| 24   | Due Report               | —        | —          | ☐          | —          | ☐    | —    | ☐      |
| 25   | Attendance Report        | —        | —          | ☐          | —          | ☐    | —    | ☐      |
| 26   | Loan Report              | —        | —          | ☐          | —          | ☐    | —    | ☐      |
| 27   | Area + Partner P&L       | —        | —          | ☐          | —          | ☐    | —    | ☐      |
| 28   | Profit Settlement        | —        | —          | ☐          | —          | ☐    | —    | ☐      |

**Cross-cutting items (done once, used everywhere):**

| Item                              | Done |
|-----------------------------------|------|
| Sidebar nav with all sections     | ☐    |
| Role-based nav (admin vs partner) | ☐    |
| Auth guard on admin-only pages    | ☐    |
| Partner data filter (own only)    | ☐    |
| Date range filter component       | ☐    |
| Currency formatting (৳)           | ☐    |
| Stock formula helper function     | ☐    |
| Customer due formula helper       | ☐    |
| Recurring task daily generator    | ☐    |
| /api/setup with full schema       | ☐    |
