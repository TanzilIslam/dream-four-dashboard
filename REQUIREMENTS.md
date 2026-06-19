# Dream Four Dashboard — Full Requirements

## 1. Business Overview

Three operational partners running a home delivery egg business in Bangladesh.
A tech partner (admin) manages the system, monitors all operations, and does no field work.
Each partner operates in assigned areas — buys stock (with admin approval), fulfills customer
orders, collects payments, and logs expenses.
A central dashboard gives admin unified visibility over all operations and financials.

**Current product:** Eggs (piece)
**Planned next product:** Water bottles (same model, separate stock pool per product)

---

## 2. People & Roles

| Role     | Count  | Description                                                   |
| -------- | ------ | ------------------------------------------------------------- |
| admin    | 1      | Tech partner — full access, config, monitoring, no field work |
| partner  | 3      | Operational — own area, own customers, own finances           |
| employee | future | Pickup/delivery only, limited access (skip for now)           |

### Access Rules

- Admin sees all data across all partners
- Each partner sees only their own data (customers, orders, finances, attendance)
- Partners cannot see each other's data
- Admin is not one of the 3 operational partners — monitoring role only

### Profit Sharing

- 3 partners split business profits (ratio TBD — configurable per partner)
- Tech/admin partner receives **7.5% of net profit** (system-configured)
- Profit settlement period: TBD (weekly or monthly — admin decides)

---

## 3. Stock Model — Central Pool (Per Product)

All purchases of a product by any partner go into one **central pool** for that product.
Partners draw from the pool when fulfilling orders.
Each product has its own separate central pool.

```
CENTRAL STOCK (e.g. Eggs) at any time:
= SUM(all purchase_requests.actual_qty where status=completed)
− SUM(all orders.quantity where status=delivered)
− SUM(all orders.quantity where status=pending)   ← reserved stock
+ SUM(all returns.quantity)
```

Investment is tracked per partner (who paid) for profit settlement.
Stock is shared — a sale by Kamal draws from the same pool that Rafi bought into.

**Admin sees:**

- Central stock level per product (available + reserved breakdown)
- Who contributed what to the pool (investment ledger)
- Who drew how much (order/delivery ledger)
- Low stock alert when available stock drops below per-product threshold

---

## 4. Master Data (Admin Only)

Configured once. Referenced across all partner operations. Partners select, never create.

### 4.1 Suppliers / Farms

| Field          | Type   | Notes                                 |
| -------------- | ------ | ------------------------------------- |
| name           | text   | Farm or supplier name                 |
| contact_person | text   | Who to call                           |
| phone          | text   | Primary phone                         |
| whatsapp       | text   | WhatsApp number                       |
| email          | text   | Email (optional)                      |
| address        | text   | Physical location/address             |
| area           | text   | Region/zone of the farm               |
| bank_name      | text   | Bank name (optional)                  |
| bank_account   | text   | Account number (optional)             |
| bkash          | text   | bKash number (optional)               |
| nagad          | text   | Nagad number (optional)               |
| default_price  | number | Usual price per unit (reference only) |
| notes          | text   | Special notes                         |
| is_active      | bool   | Enable/disable                        |

### 4.2 Areas / Territories

| Field       | Type | Notes                          |
| ----------- | ---- | ------------------------------ |
| name        | text | e.g. Mirpur, Uttara, Dhanmondi |
| description | text | Optional notes about the zone  |
| is_active   | bool | Enable/disable                 |

**Area Assignment** — many-to-many (partners ↔ areas).
One active partner per area at a time. A partner can cover multiple areas.
If a partner is reassigned, the new partner takes over all customers in that area.
Historical records remain attributed to the original partner.

### 4.3 Products

| Field               | Type   | Notes                                |
| ------------------- | ------ | ------------------------------------ |
| name                | text   | e.g. Egg, Water Bottle               |
| unit                | text   | piece / bottle / etc                 |
| default_price       | number | Default sell price per unit          |
| low_stock_threshold | number | Alert when central stock drops below |
| is_active           | bool   | Enable/disable                       |

### 4.4 Pricing Tiers

| Field      | Type   | Notes                                |
| ---------- | ------ | ------------------------------------ |
| product_id | ref    | Which product this tier applies to   |
| name       | text   | e.g. Regular, Bulk, VIP              |
| unit_price | number | Price per unit for this tier         |
| min_qty    | number | Minimum qty to qualify for this tier |

### 4.5 Expense Categories

| Field | Type | Notes                              |
| ----- | ---- | ---------------------------------- |
| name  | text | e.g. Fuel, Packaging, Labour, Misc |
| icon  | text | Optional emoji or icon label       |

### 4.6 Payment Settings (Global Config — single row)

| Field                | Type   | Notes                                 |
| -------------------- | ------ | ------------------------------------- |
| due_allowed          | bool   | Can customers carry outstanding due?  |
| max_due_per_customer | number | Default max due limit per customer    |
| late_punch_threshold | time   | e.g. 09:30 = late if punched in after |
| low_stock_default    | number | Fallback low stock threshold          |

---

## 5. Partner Daily Operations

### 5.1 Customers

Each partner manages their own customers within their assigned area(s).

| Field              | Type   | Notes                                      |
| ------------------ | ------ | ------------------------------------------ |
| partner_id         | ref    | Owning partner                             |
| area_id            | ref    | Which area this customer is in             |
| name               | text   | Customer full name                         |
| phone              | text   | Contact number                             |
| whatsapp           | text   | WhatsApp (optional)                        |
| address            | text   | Delivery address                           |
| pricing_tier_id    | ref    | Assigned pricing tier                      |
| due_allowed        | bool   | Override global setting per customer       |
| max_due            | number | Per customer due limit (overrides global)  |
| delivery_frequency | enum   | daily / every_2_days / weekly / custom     |
| delivery_interval  | number | If custom: every N days                    |
| is_paused          | bool   | Delivery currently paused                  |
| pause_start        | date   | When pause started                         |
| pause_until        | date   | Null = indefinite, set date = auto-resumes |
| pause_reason       | text   | Optional reason for pause                  |
| notes              | text   | Special delivery instructions              |
| is_active          | bool   | Soft delete                                |

**Customer Due Calculation:**

```
Outstanding due = SUM(orders.total_amount where status=delivered)
               − SUM(orders.paid_amount where status=delivered)
               − SUM(payments.amount for this customer)
```

**Due Block on Order Creation:**
If customer outstanding due ≥ max_due → order creation is blocked.
Partner sees the current due amount and must collect payment before creating a new order.

**Delivery Pause:**

- While paused: no delivery reminders shown for this customer
- If `pause_until` is set: customer auto-resumes on that date
- If `pause_until` is null: partner must manually unpause

### 5.2 Purchase Requests

Two-step: member submits request → admin approves → member buys and records actuals.

| Field           | Type     | Notes                                           |
| --------------- | -------- | ----------------------------------------------- |
| partner_id      | ref      | Who is requesting                               |
| supplier_id     | ref      | Which supplier/farm (admin-managed list)        |
| product_id      | ref      | Which product                                   |
| requested_qty   | number   | How many units requested                        |
| estimated_price | number   | Expected price per unit                         |
| estimated_total | number   | requested_qty × estimated_price                 |
| status          | enum     | pending / approved / rejected / completed       |
| admin_note      | text     | Admin note on approval or rejection             |
| approved_by     | ref      | Admin who approved                              |
| approved_at     | datetime | When approved                                   |
| actual_qty      | number   | Actual qty purchased (may differ from request)  |
| actual_price    | number   | Actual price per unit                           |
| actual_total    | number   | actual_qty × actual_price                       |
| purchased_at    | date     | Date of actual purchase                         |
| payment_method  | enum     | cash / bank / bkash / nagad                     |
| from_personal   | bool     | Partner used personal funds → auto-creates loan |
| note            | text     | Partner note                                    |
| completed_at    | datetime | When partner marked as purchased                |

**Flow:**

1. Partner submits request (status = pending)
2. Admin approves or rejects (with optional note)
3. After approval, partner goes and buys
4. Partner records actual qty and price (can differ — no re-approval needed)
5. Status → completed; actual_qty added to central stock pool
6. If `from_personal = true` → a partner loan record is auto-created for `actual_total`

### 5.3 Orders

Partner logs a customer order. Stock reserved immediately from central pool.
Partner delivers, then marks as delivered and records payment.

| Field                 | Type     | Notes                                        |
| --------------------- | -------- | -------------------------------------------- |
| partner_id            | ref      | Who took the order                           |
| customer_id           | ref      | Which customer                               |
| area_id               | ref      | Area of delivery                             |
| product_id            | ref      | Which product                                |
| quantity              | number   | Units ordered (fixed at order time)          |
| unit_price            | number   | Price per unit                               |
| total_amount          | number   | quantity × unit_price                        |
| status                | enum     | pending / delivered / cancelled              |
| ordered_at            | datetime | When order was created                       |
| delivered_at          | datetime | When marked as delivered                     |
| paid_amount           | number   | Amount paid at delivery (full or partial)    |
| due_amount            | number   | total_amount − paid_amount                   |
| promised_payment_date | date     | If partial — when customer will pay the rest |
| payment_method        | enum     | cash / bank / bkash / nagad                  |
| cancellation_reason   | text     | Required if cancelled                        |
| note                  | text     | Optional                                     |

**Stock flow:**

- Order created (pending) → qty reserved from central pool (counted as drawn)
- Order delivered → stock draw confirmed, payment recorded
- Order cancelled → reserved qty returned to central pool

**Due check at order creation:**
If customer outstanding due ≥ max_due → block order creation.
Partner must collect payment first to bring due below limit.

**Payment at delivery:**
Partner records how much customer paid on the spot.

- Full payment → due_amount = 0
- Partial payment → due_amount > 0, partner sets promised_payment_date
- No payment → paid_amount = 0, full amount goes to due

### 5.4 Due Collections / Payments

When a customer pays off a previous outstanding due (separate from delivery payment).

| Field                 | Type     | Notes                                        |
| --------------------- | -------- | -------------------------------------------- |
| partner_id            | ref      | Who collected                                |
| customer_id           | ref      | Who paid                                     |
| order_id              | ref      | Linked to specific order (optional)          |
| amount                | number   | Amount collected                             |
| payment_method        | enum     | cash / bank / bkash / nagad                  |
| paid_at               | datetime | When collected                               |
| promised_payment_date | date     | If partial — when customer will pay the rest |
| note                  | text     | Optional                                     |

### 5.5 Returns

When a delivery fails or eggs are damaged.
Returned quantity goes back into the central stock pool.

| Field       | Type   | Notes                                        |
| ----------- | ------ | -------------------------------------------- |
| partner_id  | ref    | Who is returning                             |
| order_id    | ref    | Which order (optional)                       |
| customer_id | ref    | Which customer                               |
| product_id  | ref    | Which product                                |
| quantity    | number | Units returned                               |
| reason      | enum   | not_home / damaged / order_cancelled / other |
| returned_at | date   | Date of return                               |
| note        | text   | Optional                                     |

### 5.6 Expenses

Daily costs logged by each partner.

| Field          | Type   | Notes                       |
| -------------- | ------ | --------------------------- |
| partner_id     | ref    | Who spent                   |
| area_id        | ref    | Area (optional)             |
| category_id    | ref    | Expense category            |
| amount         | number | Amount spent                |
| payment_method | enum   | cash / bank / bkash / nagad |
| description    | text   | What it was for             |
| date           | date   | Date of expense             |

### 5.7 Cash Remittances

When a partner submits physical cash or transfer to the business account.
Admin must acknowledge receipt before it counts as remitted.

| Field           | Type     | Notes                       |
| --------------- | -------- | --------------------------- |
| partner_id      | ref      | Who is submitting           |
| amount          | number   | Amount submitted            |
| payment_method  | enum     | cash / bank / bkash / nagad |
| submitted_at    | datetime | When partner recorded it    |
| note            | text     | Partner note (optional)     |
| status          | enum     | pending / acknowledged      |
| acknowledged_by | ref      | Admin who confirmed         |
| acknowledged_at | datetime | When admin confirmed        |
| admin_note      | text     | Admin note (optional)       |

**Partner Cash In Hand (cash only):**

```
Cash in hand =
  SUM(orders.paid_amount where payment_method=cash and status=delivered)
+ SUM(payments.amount where payment_method=cash)
− SUM(expenses.amount where payment_method=cash)
− SUM(remittances.amount where payment_method=cash and status=acknowledged)
```

Non-cash payments (bkash/bank/nagad) go directly to business — not counted in hand.

### 5.8 Partner Loans

When a partner uses personal money for a business purchase (temporary).
Business tracks this as a loan and must pay back.

**Loans:**

| Field      | Type   | Notes                                        |
| ---------- | ------ | -------------------------------------------- |
| partner_id | ref    | Which partner lent money                     |
| amount     | number | Loan amount                                  |
| reason     | text   | What it was for (e.g. egg purchase)          |
| source_id  | ref    | purchase_request_id that triggered this loan |
| loaned_at  | date   | Date of loan                                 |
| status     | enum   | outstanding / partially_repaid / repaid      |
| note       | text   | Optional                                     |

**Loan Repayments:**

| Field     | Type     | Notes                       |
| --------- | -------- | --------------------------- |
| loan_id   | ref      | Which loan is being repaid  |
| amount    | number   | Amount repaid               |
| method    | enum     | cash / bank / bkash / nagad |
| repaid_at | datetime | When repaid                 |
| note      | text     | Optional                    |

---

## 6. Attendance & Time Tracking

Each partner punches for every activity throughout the day.
Used for monitoring and future performance metrics.

### Activity Types

| Code                | Label                   | Paired? |
| ------------------- | ----------------------- | ------- |
| punch_in            | Start of Day            | No      |
| lunch_out           | Lunch Break             | Yes ↓   |
| lunch_in            | Back from Lunch         | Yes ↑   |
| farm_out            | Went to Collect Stock   | Yes ↓   |
| farm_in             | Back from Farm          | Yes ↑   |
| delivery_out        | Out for Delivery        | Yes ↓   |
| delivery_in         | Back from Delivery      | Yes ↑   |
| cash_collection_out | Out for Cash Collection | Yes ↓   |
| cash_collection_in  | Back from Collection    | Yes ↑   |
| punch_out           | End of Day              | No      |

### Attendance Log

| Field         | Type     | Notes                                |
| ------------- | -------- | ------------------------------------ |
| partner_id    | ref      | Which partner                        |
| activity      | enum     | Activity type                        |
| punched_at    | datetime | Exact timestamp of the punch         |
| note          | text     | Optional (e.g. "farm was far today") |
| location      | text     | Optional location tag                |
| is_corrected  | bool     | Was this a self-correction?          |
| original_time | datetime | Original timestamp before correction |

**Computed per day:**

```
Total hours     = punch_out − punch_in
Lunch duration  = lunch_in − lunch_out
Net hours       = Total − Lunch
Farm time       = farm_in − farm_out
Delivery time   = delivery_in − delivery_out
Collection time = cash_collection_in − cash_collection_out
```

**Admin alerts:**

- Late punch-in (after admin-configured threshold in Payment Settings)
- No punch-out by end of day
- Absent (no punch-in at all)
- Unusually long break duration

**Punch correction:**
Partner can self-correct a wrong punch the next day.
Original time preserved for audit. Admin is not notified — silently recorded.

---

## 7. Task Management

Admin assigns tasks to partners. Partners can also create personal tasks for themselves only.

| Field        | Type     | Notes                                      |
| ------------ | -------- | ------------------------------------------ |
| assigned_to  | ref      | Partner (user)                             |
| created_by   | ref      | Who created (admin or self)                |
| is_self_task | bool     | True if partner created for themselves     |
| title        | text     | Short task description                     |
| description  | text     | Detailed instructions                      |
| due_date     | date     | When it must be done                       |
| priority     | enum     | low / normal / high / urgent               |
| type         | enum     | one_time / daily_recurring                 |
| status       | enum     | pending / in_progress / completed / missed |
| completed_at | datetime | When partner marked it done                |
| note         | text     | Partner completion note                    |

**Recurring tasks:** Admin creates once → system auto-generates for each new day.

---

## 8. Daily Report (End of Day)

Mandatory per partner per working day. Auto-built from actual data entries.
Partner reviews, adds a note, and submits. Admin reviews all submitted reports.
If not submitted → partner receives a bad score flag for that day.

| Field          | Type     | Notes                                      |
| -------------- | -------- | ------------------------------------------ |
| partner_id     | ref      | Reporting partner                          |
| report_date    | date     | Which day this covers                      |
| status         | enum     | draft / submitted / reviewed               |
| eggs_delivered | number   | Auto: SUM(orders.quantity where delivered) |
| cash_collected | number   | Auto: SUM(paid at delivery + payments)     |
| due_added      | number   | Auto: SUM(orders.due_amount for day)       |
| eggs_returned  | number   | Auto: SUM(returns.quantity for day)        |
| total_expenses | number   | Auto: SUM(expenses for day)                |
| member_note    | text     | Manual note from partner                   |
| submitted_at   | datetime | When partner submitted                     |
| reviewed_by    | ref      | Admin who reviewed                         |
| reviewed_at    | datetime | When admin reviewed                        |
| admin_note     | text     | Admin feedback/note                        |

**Customer-wise due snapshot attached to each report:**

| Field         | Type   | Notes                         |
| ------------- | ------ | ----------------------------- |
| report_id     | ref    | Which report                  |
| customer_id   | ref    | Customer                      |
| delivered_qty | number | Eggs delivered today          |
| charged       | number | Total charged today           |
| collected     | number | Total collected today         |
| due_balance   | number | Running total outstanding due |

---

## 9. Reminders (Partner Dashboard)

### Delivery Reminders

```
last_delivered_at = MAX(orders.delivered_at) for this customer
next_delivery_date = last_delivered_at + delivery_interval (days)
```

- Customer paused → hidden from reminder list
- `next_delivery_date` ≤ today → "Call Today" list
- `next_delivery_date` = tomorrow → "Upcoming" list
- No deliveries yet → "Not yet delivered"

### Payment Due Reminders

```
If any order has promised_payment_date ≤ today AND due_amount > 0
→ show in "Payment Due Today" list
```

Both lists visible to each partner for their own customers only.
Admin sees all reminders across all partners.

---

## 10. Admin Dashboard — Daily View

### Business Pulse (Top Bar)

Today vs yesterday comparison:

- Total eggs sold
- Total cash collected
- New due added
- Total expenses
- Central stock level per product (with low stock alert)

### Partner Performance Table (today)

| Partner | Areas | Orders | Sold (qty) | Collected (৳) | Due Added (৳) | Expenses (৳) |

### Stock Overview (per product)

| Product | Total Purchased | Total Delivered | Reserved (pending) | Available |

### Outstanding Due Summary

- Total due across all partners
- Top 5 customers by outstanding due
- Oldest unpaid record (customer, partner, days overdue, amount)
- Payment promises due today (promised_payment_date ≤ today)

### Attendance Summary (today)

| Partner | Status | Punch In | Punch Out | Net Hours |
Statuses: On Time / Late / Absent / Still Working

### Pending Admin Actions

- Purchase requests awaiting approval
- Cash remittances awaiting acknowledgment
- Daily reports not yet reviewed

---

## 11. Central Money Monitoring (Admin)

### Investment Ledger

All purchase_requests (completed) across all partners.

| Date | Partner | Supplier | Product | Req Qty | Actual Qty | Unit Cost | Total Cost |

### Expense Ledger

All expenses across all partners.

| Date | Partner | Area | Category | Amount | Method | Description |

### Partner Cash Flow Position

| Partner | Invested (৳) | Expenses (৳) | Collected (৳) | Cash in Hand (৳) | Pending Remittance (৳) | Outstanding Due (৳) | Stock Value (৳) | Net |

```
Net = Collected + Outstanding Due + Stock Value − Invested − Expenses
```

### Loan Tracker

| Partner | Total Loaned | Total Repaid | Outstanding Balance |

### Monthly P&L Snapshot

```
Revenue      = SUM(orders.total_amount where status=delivered)
Stock Cost   = SUM(purchase_requests.actual_total where status=completed)
Expenses     = SUM(expenses.amount)
─────────────────────────────────────────────────────
Net Profit   = Revenue − Stock Cost − Expenses
Tech share   = Net Profit × 7.5%
Partner pool = Net Profit − Tech share
Per partner  = Partner pool ÷ 3 (or per configured ratio)
```

---

## 12. Reports

All reports filterable by: Today / This Week / This Month / Custom range

| #   | Report            | Description                                                                                  |
| --- | ----------------- | -------------------------------------------------------------------------------------------- |
| 1   | Due Report        | All customers with outstanding balance, filter by partner/area, days overdue, promised dates |
| 2   | Stock Report      | Per product: purchased vs delivered vs reserved vs available, unsold stock value             |
| 3   | Area Report       | Sales volume, revenue, due per area                                                          |
| 4   | Partner P&L       | Invested, revenue, collected, due, expenses, net per partner                                 |
| 5   | Attendance Report | Daily hours, late/absent, activity breakdown per partner                                     |
| 6   | Loan Report       | Partner loans, repayments, outstanding balance                                               |
| 7   | Supplier Report   | Purchases per supplier, price history over time                                              |
| 8   | Profit Settlement | Period P&L, tech partner share, partner payouts                                              |

---

## 13. DB Tables

```
users                    existing — partners + admin
areas                    master — territories
user_areas               partner ↔ area many-to-many
suppliers                master — farms and vendors (admin managed)
products                 master — egg, water bottle, etc
pricing_tiers            master — per product pricing tiers
expense_categories       master — expense labels
payment_settings         global config — single row
customers                per partner, per area, with delivery schedule + pause
purchase_requests        member request → admin approval → actual recorded
orders                   customer order → stock reserved → delivered or cancelled
payments                 due collections (separate from delivery payment)
returns                  failed/damaged deliveries → restores central stock
expenses                 per partner daily costs
cash_remittances         partner submits to business → admin acknowledges
partner_loans            personal investment as business loan (auto or manual)
loan_repayments          business repays partner
attendance_logs          timestamped activity punches with correction tracking
tasks                    admin assigns + partner self-tasks + recurring support
daily_reports            end-of-day submission per partner per day
daily_report_customers   customer due snapshot attached to each daily report
```

---

## 14. Module Build Order

| Step | Module                     | Description                                                      |
| ---- | -------------------------- | ---------------------------------------------------------------- |
| 1    | Settings — Suppliers       | Farm/vendor master data (all contact + payment info)             |
| 2    | Settings — Areas           | Territory management + partner assignment                        |
| 3    | Settings — Products        | Product list, units, default price, low stock threshold          |
| 4    | Settings — Pricing Tiers   | Per product pricing tiers (regular, bulk, VIP)                   |
| 5    | Settings — Expense Cat.    | Expense category labels                                          |
| 6    | Settings — Payment Config  | Global due/payment config + late punch threshold                 |
| 7    | Customers                  | Per partner customer list with delivery schedule + pause support |
| 8    | Purchase Requests          | Request → admin approval → actual purchase recorded              |
| 9    | Orders                     | Create order (reserve stock), mark delivered + payment, cancel   |
| 10   | Returns                    | Failed/damaged → restores central stock                          |
| 11   | Due Collections            | Collect outstanding payment from customer                        |
| 12   | Expenses                   | Daily expense logging per partner                                |
| 13   | Cash Remittances           | Partner submits cash to business, admin acknowledges             |
| 14   | Partner Loans              | Personal investment as loan + repayment tracking                 |
| 15   | Attendance                 | Punch in/out, activity log, self-correction                      |
| 16   | Tasks                      | Admin assigns + partner self-tasks + recurring auto-repeat       |
| 17   | Daily Report               | End-of-day auto-report, partner submits, admin reviews           |
| 18   | Reminders                  | Delivery call-today + payment promise alerts                     |
| 19   | Member Daily Summary       | Partner's own view — tasks, reminders, timeline, stock           |
| 20   | Admin Overview             | Central dashboard — pulse, partner table, stock, alerts          |
| 21   | Investment Ledger          | All purchases across partners (admin view)                       |
| 22   | Expense Ledger             | All expenses across partners (admin view)                        |
| 23   | Cash Flow Report           | Partner money position — in vs out vs pending                    |
| 24   | Due Report                 | Outstanding dues, overdue, top debtors, payment promises         |
| 25   | Attendance Report          | Hours, late/absent alerts, activity breakdown                    |
| 26   | Loan Report                | Partner loans, repayments, outstanding balance                   |
| 27   | Area + Partner P&L Reports | Profitability per area and per partner                           |
| 28   | Profit Settlement          | Period P&L + tech partner share + partner payout calculation     |

---

## 15. Tech Stack

| Layer      | Choice                                       |
| ---------- | -------------------------------------------- |
| Frontend   | Next.js 16, React 19, Tailwind v4, shadcn/ui |
| Backend    | Next.js API Routes (serverless)              |
| Database   | Neon (Postgres)                              |
| Auth       | iron-session (encrypted cookie)              |
| Hosting    | Vercel free tier                             |
| Files      | Vercel Blob (avatars, documents)             |
| Validation | Zod + react-hook-form                        |

---

## 16. Currency & Units

- Currency: BDT (৳)
- All amounts stored as `numeric(12,2)`
- Product quantities stored as integers (piece count)
- Each product uses its own unit label (egg = piece, water = bottle)

---

## 17. Confirmed Decisions

- Stock model: central pool per product (confirmed)
- Order → delivery is two-step: order created first, delivered separately
- Stock reserved on order creation; released on cancel; confirmed on delivery
- Due limit enforced at order creation (block, not warn)
- Payment methods: cash / bank / bkash / nagad (tracked per transaction)
- Cash in hand tracked per partner (cash only; bkash/bank goes direct to business)
- Cash remittance requires admin acknowledgment to count
- Purchase flow: request → admin approval → actual purchase (adjustable, no re-approval)
- Personal purchase funds → auto-created loan to business
- Loan repayment tracked as transaction
- Supplier master data managed by admin; partners only select
- Customer pause: standard (pause_start, pause_until, auto-resume on date)
- Attendance for monitoring only (future: performance metrics)
- Late threshold: admin configurable
- Punch self-correction: allowed, silently tracked, no admin notification
- Tasks: admin assigns, partners can self-create personal tasks only
- Recurring tasks: auto-repeat daily
- Daily report: mandatory; missing = bad score flag
- Promised payment date tracked per order and per payment (drives reminder alerts)
- Admin (tech partner) gets 7.5% of net profit; 3 partner split TBD
- Admin does no field operations — monitoring and config only
- Future: employees (pickup/delivery only, limited access)
- Future: water bottles — same model, separate central stock pool

---

## 18. Open Decisions

- [ ] Profit split ratio among 3 operational partners (equal or contribution-based?)
- [ ] Profit settlement period (weekly or monthly?)
- [ ] Can admin edit/correct a partner's submitted entry (e.g. fix wrong sale price)?
- [ ] Delivery reminder — in-app only, or also WhatsApp/SMS notification?
- [ ] Can a customer belong to multiple partners, or strictly one partner at a time?
- [ ] When partner is reassigned: are their historical records kept under original partner or transferred?
- [ ] Bad score flags — is there a threshold or consequence (e.g. 3 missed reports = action)?
