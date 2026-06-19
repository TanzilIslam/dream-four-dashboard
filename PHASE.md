# Dream Four Dashboard — Development Phases

---

## Overview

| Phase | Name                 | Steps       | Goal                                              |
| ----- | -------------------- | ----------- | ------------------------------------------------- |
| 1     | Foundation           | Steps 1–6   | Master data — system is configurable              |
| 2     | Core Operations      | Steps 7–9   | Partners can manage customers, buy stock, deliver |
| 3     | Money Tracking       | Steps 10–14 | Returns, due, expenses, cash, loans               |
| 4     | People Tracking      | Steps 15–17 | Attendance, tasks, daily reports                  |
| 5     | Intelligence Layer   | Steps 18–20 | Reminders, dashboards (member + admin)            |
| 6     | Reports & Settlement | Steps 21–28 | All reports, P&L, profit settlement               |

Each phase is independently deployable and testable before moving on.

---

## Phase 1 — Foundation

**Goal:** Admin can configure the entire system before any partner starts working.
No operational module works correctly without this data.

**Modules:**

| Step | Module             | What it enables                                        |
| ---- | ------------------ | ------------------------------------------------------ |
| 1    | Suppliers          | Partners can select supplier when requesting stock     |
| 2    | Areas + Assignment | Partners are assigned zones; customers belong to zones |
| 3    | Products           | Orders, purchases, returns all reference a product     |
| 4    | Pricing Tiers      | Customers get assigned a price tier                    |
| 5    | Expense Categories | Expenses can be categorized                            |
| 6    | Payment Config     | Due limits, late punch threshold, low stock threshold  |

**DB tables created:** suppliers, areas, user_areas, products, pricing_tiers, expense_categories, payment_settings

**End of Phase 1 — Admin can:**

- Add farms/suppliers with full contact details
- Create delivery zones and assign partners to them
- Define products (egg, future: water bottle) with pricing
- Set pricing tiers per product (Regular, Bulk, VIP)
- Create expense categories
- Configure global business rules (due limit, late punch time)

**Partners can:**

- Log in and see their assigned areas (read-only at this stage)

---

## Phase 2 — Core Operations

**Goal:** Partners can do their primary daily job — manage customers, request stock, take and fulfill orders.
This is the heart of the system.

**Modules:**

| Step | Module            | What it enables                                               |
| ---- | ----------------- | ------------------------------------------------------------- |
| 7    | Customers         | Partners add their customers with delivery schedule           |
| 8    | Purchase Requests | Partners request stock → admin approves → partner records buy |
| 9    | Orders            | Partners log customer orders, deliver, collect payment        |

**DB tables created:** customers, purchase_requests, orders

**Key flows built:**

- Partner creates customer with area, pricing tier, delivery schedule, due limit
- Partner submits purchase request → admin sees pending list → approves/rejects
- After approval: partner marks as purchased with actual qty/price
- Stock auto-added to central pool on completion
- Partner creates order (due limit checked, stock reserved)
- Partner marks order as delivered + records payment (full/partial/none)
- Order cancelled → stock released back to pool

**End of Phase 2 — System can:**

- Track central stock level (purchased − delivered − reserved)
- Block orders when customer due exceeds limit
- Show each partner their own customers and order history
- Admin sees all purchase requests and all orders

**Partners can:**

- Fully run their daily delivery operations

---

## Phase 3 — Money Tracking

**Goal:** Complete the financial picture — returns, due collections, expenses, cash in hand, partner loans.
After this phase, admin has full visibility of where every taka is.

**Modules:**

| Step | Module           | What it enables                                            |
| ---- | ---------------- | ---------------------------------------------------------- |
| 10   | Returns          | Failed/damaged deliveries restore stock                    |
| 11   | Due Collections  | Partners collect outstanding customer dues                 |
| 12   | Expenses         | Partners log daily operational costs                       |
| 13   | Cash Remittances | Partners submit collected cash to business; admin confirms |
| 14   | Partner Loans    | Track personal investments as loans + repayment            |

**DB tables created:** returns, payments, expenses, cash_remittances, partner_loans, loan_repayments

**Key flows built:**

- Partner logs return (reason + qty) → stock restored
- Partner collects old due → customer balance reduces → cash in hand increases
- Partner logs expense (fuel, packaging, etc.) with payment method
- Partner submits cash to business → admin acknowledges → counts as remitted
- Auto-loan created when purchase paid from personal money
- Admin repays partner loan → loan status updates

**End of Phase 3 — Admin can see:**

- Per partner: invested, expenses, cash collected, cash in hand, cash remitted, outstanding due
- Who owes what to the business (loans)
- Full stock level (purchases + returns − deliveries − reserved)
- Every single financial transaction across all partners

---

## Phase 4 — People Tracking

**Goal:** Track partner working hours, assigned tasks, and daily performance.
Builds accountability and gives admin visibility beyond just financials.

**Modules:**

| Step | Module       | What it enables                                             |
| ---- | ------------ | ----------------------------------------------------------- |
| 15   | Attendance   | Partners punch in/out for each activity; admin tracks hours |
| 16   | Tasks        | Admin assigns tasks; partners complete and report back      |
| 17   | Daily Report | End-of-day auto-report per partner; admin reviews           |

**DB tables created:** attendance_logs, tasks, daily_reports, daily_report_customers

**Key flows built:**

- Partner punches activity (punch_in, farm_out, delivery_out, etc.) with timestamp
- Attendance timeline built from punches per day
- Net hours, lunch duration, farm time, delivery time computed
- Late/absent alerts for admin
- Admin assigns one-time or recurring daily tasks to partners
- Partners mark tasks done + add completion note
- Partner views auto-built daily report at end of day
- Partner adds note, submits report
- Admin reviews submitted report, adds note, marks reviewed
- Missing report = bad score flag on partner record

**End of Phase 4 — Admin can:**

- See who is working, who is late, who is absent — in real time
- Assign and track task completion across all partners
- Review each partner's end-of-day report with customer due snapshot

---

## Phase 5 — Intelligence Layer

**Goal:** Proactive alerts and centralized dashboards. System tells users what to do next without them having to search.

**Modules:**

| Step | Module                | What it enables                                         |
| ---- | --------------------- | ------------------------------------------------------- |
| 18   | Reminders             | Call-today list + payment promise alerts per partner    |
| 19   | Partner Daily Summary | Partner's own home — tasks, reminders, quick stats      |
| 20   | Admin Overview        | Central dashboard — pulse, stock, partner table, alerts |

**New API endpoints:** `/api/analytics/overview`, `/api/analytics/reminders`, `/api/analytics/stock`, `/api/analytics/partners`, `/api/analytics/attendance`

**Key features built:**

**Partner dashboard:**

- "Call Today" delivery list (next_delivery_date ≤ today, not paused)
- "Payment Due Today" list (promised_payment_date ≤ today, due > 0)
- My Tasks Today (pending/done count)
- Today's quick stats (orders, collected, expenses)
- Quick action buttons (New Order, Punch, Log Expense)

**Admin dashboard:**

- 4 KPI cards: eggs sold, cash in, new due, expenses — today vs yesterday
- Central stock per product with low stock alert
- Partner performance table (today)
- Pending actions: purchase requests, remittances, reports to review
- Outstanding due: total, top 5 debtors, oldest unpaid
- Attendance summary table (on time / late / absent)

**End of Phase 5 — System is fully operational:**

- Partners know exactly who to call and when
- Admin sees the entire business at a glance
- All alerts and blockers working correctly

---

## Phase 6 — Reports & Settlement

**Goal:** Deep-dive analytics, period reporting, and profit settlement.
The system goes from operational to strategic.

**Modules:**

| Step | Module             | What it shows                                               |
| ---- | ------------------ | ----------------------------------------------------------- |
| 21   | Investment Ledger  | All stock purchases across partners — who bought what, when |
| 22   | Expense Ledger     | All expenses across partners — by category, area, partner   |
| 23   | Cash Flow Report   | Per partner: invested vs collected vs expenses vs in-hand   |
| 24   | Due Report         | All customers with outstanding due, days overdue, promises  |
| 25   | Attendance Report  | Hours, late/absent count, activity time breakdown           |
| 26   | Loan Report        | Partner loans, repayments, outstanding balance              |
| 27   | Area + Partner P&L | Profitability per area; per-partner revenue vs cost vs net  |
| 28   | Profit Settlement  | Period P&L → tech share → per-partner payout                |

**All reports support:**

- Date range filter: Today / This Week / This Month / Custom range
- Filter by partner or area where applicable

**Key calculations in Phase 6:**

```
Stock Report:
  Available = purchased_qty − delivered_qty − reserved_qty + returned_qty

Partner P&L:
  Revenue     = SUM(orders.total_amount where delivered)
  Stock Cost  = SUM(purchase_requests.actual_total where completed)
  Expenses    = SUM(expenses.amount)
  Net         = Revenue − Stock Cost − Expenses

Profit Settlement:
  Tech share     = Net Profit × 7.5%
  Partner pool   = Net Profit − Tech share
  Per partner    = Partner pool ÷ 3 (or per configured ratio)
```

**End of Phase 6 — Complete product:**

- Admin can generate any financial report for any period
- Profit settlement calculated automatically
- Every module from Phase 1 to 6 is interconnected and consistent

---

## Phase Dependencies

```
Phase 1 (Master Data)
  └── Phase 2 (Operations) — needs areas, products, suppliers, pricing tiers
        └── Phase 3 (Money) — needs customers and orders to exist
              └── Phase 4 (People) — can run parallel to Phase 3 after Phase 2
                    └── Phase 5 (Dashboards) — needs all data to aggregate
                          └── Phase 6 (Reports) — needs all data, built last
```

Phase 4 (Attendance + Tasks) can be started alongside Phase 3 since it doesn't depend on returns/expenses/loans.

---

## What Partners Can Do After Each Phase

| After Phase | Partner Can                                                           |
| ----------- | --------------------------------------------------------------------- |
| 1           | Log in, see their area — nothing else                                 |
| 2           | Add customers, request stock, create orders, deliver, collect payment |
| 3           | Log returns, collect dues, record expenses, submit cash, track loans  |
| 4           | Punch attendance, complete tasks, submit daily reports                |
| 5           | See proactive reminders, their daily summary dashboard                |
| 6           | View their own P&L and due report                                     |

## What Admin Can Do After Each Phase

| After Phase | Admin Can                                                  |
| ----------- | ---------------------------------------------------------- |
| 1           | Configure all master data — system ready for partners      |
| 2           | Approve purchase requests, see all orders and stock level  |
| 3           | See full financial position: cash flow, loans, remittances |
| 4           | Track attendance, assign tasks, review daily reports       |
| 5           | Monitor the full business from one dashboard in real time  |
| 6           | Generate all reports, calculate profit, run settlement     |

---

## Estimated Build Sequence Per Session

Each step = one focused session.
Steps 1–6 are small (settings modules — similar pattern, fast to build).
Steps 7–14 are medium (core operations — more business logic).
Steps 15–17 are medium-large (attendance timeline, report generation).
Steps 18–20 are large (dashboard aggregation queries).
Steps 21–28 are medium (report pages — mostly read-only queries + UI).
