# Frontend / Backend Inconsistency Audit

**Repository:** `dream-four-dashboard`
**Date:** 2026-07-03
**Scope:** Every frontend `fetch` call in `app/dashboard/**` and `app/(auth)/**` compared against its backend route handler (`app/api/**`), Zod schema (`lib/schemas/**`), and SQL output.

Each finding was verified on **both** sides (frontend request + response usage vs. backend validation, query params, and returned columns). Backend-only bugs surfaced along the way are listed separately at the end.

## Summary

| Severity | Count |
|----------|-------|
| 🔴 High | 6 |
| 🟠 Medium | 6 |
| 🟡 Low | 6 |
| **Total** | **18** |

Domains with **no** contract mismatches: **Customers & Dues**, **Reports / Analytics / Overview** (notably well-aligned).

---

## 🔴 High severity

### 1. Orders table wipes itself blank after a standalone asset return
- **Effect:** After recording an asset return, the orders table empties to nothing until the next filter change or page reload.
- **Frontend:** `app/dashboard/orders/page.tsx:641` — refetches with the raw filter value, skipping the `due → all` mapping (`apiStatus`, `:278`) used everywhere else:
  ```js
  fetch(`/api/orders?status=${filters.status !== "all" ? filters.status : "all"}`)
    .then((r) => r.json())
    .then(setOrders);
  ```
  The default `filters.status` is `"due"` (`:165`, reset to `"due"` at `:413`).
- **Backend:** `app/api/orders/route.ts:11-16` treats the value as a literal status:
  ```js
  const status = url.searchParams.get("status");
  const statusFilter =
    status && status !== "all"
      ? sql`AND o.status = ${status}`
      : sql`AND o.status NOT IN ('cancelled')`;
  ```
- **Mismatch:** No order ever has status `due` (only `pending|delivered|paid|cancelled`), so `AND o.status = 'due'` matches nothing → `setOrders([])`.

### 2. Partner-loans "All" filter silently hides settled loans
- **Effect:** Selecting "All" behaves identically to "Outstanding"; settled loans never appear.
- **Frontend:** `app/dashboard/partner-loans/page.tsx:117` offers the option; fetched at `:60` / `:76`:
  ```tsx
  <SelectItem value="all">All</SelectItem>
  ...
  fetch(`/api/partner-loans?status=${statusFilter}`)
  ```
- **Backend:** `app/api/partner-loans/route.ts:12-15`:
  ```ts
  const statusFilter =
    status && status !== "all"
      ? sql`AND pl.status = ${status}`
      : sql`AND pl.status = 'outstanding'`;
  ```
- **Mismatch:** When `status === "all"`, the condition is false → falls into `else` = `AND pl.status = 'outstanding'`. The `all` case was meant to drop the filter entirely. (`settled` works; only `all` is broken. Cash-remittances handles `all` correctly, confirming the deviation.)

### 3. Saving your profile wipes `avatar_url` and `documents`
- **Effect:** Every profile save resets `avatar_url` to `NULL` and `documents` to `[]` in the DB.
- **Frontend:** `app/dashboard/profile/page.tsx:36-41` sends `JSON.stringify(data)` where `data` is the shared `ProfileInput` = `{ name, email, phone, whatsapp }` (`lib/schemas/profile.ts:3-8`). The form has no avatar/documents fields, so those keys are never sent.
- **Backend:** `app/api/profile/route.ts:7-22` defines a *different* inline schema that additionally declares `avatar_url` and `documents`, and the PUT handler (`:47-58`) writes both columns unconditionally:
  ```ts
  avatar_url = ${avatar_url ?? null}
  documents  = ${JSON.stringify(documents ?? [])}
  ```
- **Mismatch:** Both columns exist (`app/api/setup/route.ts:21-22`, `documents JSONB NOT NULL DEFAULT '[]'`); since the client never sends them, stored values are destroyed on first save.

### 4. `PUT` / `DELETE /api/users/[id]` have no authorization (privilege escalation)
- **Effect:** Any authenticated partner can change any user's `role` to `admin`, or delete any user.
- **Frontend:** treats user edit/delete as admin-only (`app/dashboard/users/page.tsx:197-224`).
- **Backend:** `app/api/users/[id]/route.ts` never calls `requireAdmin` in PUT (`:5`) or DELETE (`:38`) — it does not even import it — unlike the sibling `app/api/users/route.ts:7,19`. There is no `middleware.ts`.
- **Mismatch:** The frontend's admin-only presentation is not enforced server-side.

### 5. `POST /api/auth/impersonate` has no authorization (privilege escalation)
- **Effect:** Any logged-in partner can POST an admin's id and instantly become that admin.
- **Frontend:** impersonation surfaced only to admins (`app/dashboard/users/page.tsx:60-74`, sending `{ id }`).
- **Backend:** `app/api/auth/impersonate/route.ts:6-27` reads `{ id }` and rewrites `session.user` with **no** `requireAdmin`/`requireUser` check.
- **Mismatch:** Admin-only UI intent vs. zero backend enforcement.

### 6. Calendar opens the wrong day (timezone off-by-one)
- **Effect:** Clicking a calendar day opens the detail sheet for the *previous* day's stock/purchases/orders. App is BDT (UTC+6), so effectively always wrong.
- **Frontend:** `app/dashboard/calendar/page.tsx:117-118`:
  ```js
  const dateStr = selected.toISOString().slice(0, 10);
  fetch(`/api/calendar/day?date=${dateStr}&product_id=${productFilter}`)
  ```
  `selected` is a local-midnight `Date`; `.toISOString()` shifts it to UTC (`2026-07-03T00:00` local → `2026-07-02` in UTC+6).
- **Backend:** `app/api/calendar/day/route.ts:9` uses `date` literally as `${date}::date` (lines 65, 74, 82, 123, 146).
- **Mismatch:** The other date pickers (attendance/daily-reports) use `<input type="date">` raw strings and are correct — only the calendar shifts via `toISOString`.

---

## 🟠 Medium severity

### 7. Payment sheet title reverts to "Order" after recording a payment
- **Frontend:** `app/dashboard/orders/page.tsx:574-576` stores the response as a full `Order`; header at `:1383` reads `paymentSheetTarget?.customer_name ?? "Order"`.
- **Backend:** `app/api/orders/[id]/route.ts:63-73` pay branch does `UPDATE orders … RETURNING *` — bare row, no joins.
- **Mismatch:** The `Order` type expects joined fields (`customer_name`, `area_name`, `product_name`, `product_unit`, `unreturned_assets`, `last_payment_date`), none present on `RETURNING *`. After paying, `setPaymentSheetTarget(updatedOrder)` loses `customer_name` and the sheet title reverts to "Order".

### 8. Partner opening purchase-request details always sees ৳0.00 payments
- **Frontend:** the details "eye" button (`app/dashboard/purchase-requests/page.tsx:800`) is **not** `isAdmin`-gated (all mutating buttons are); it fetches `…/payments` (`:227-243`) and reads `data.payments`, `data.paid_total`, `data.due_amount`, `data.actual_total`.
- **Backend:** `app/api/purchase-requests/[id]/payments/route.ts:12` is `requireAdmin` → returns **403** for partners.
- **Mismatch:** The 403 body is swallowed (`data.payments ?? []`, `Number(data.actual_total ?? 0)`), so a partner viewing their own purchased request always sees "No payments recorded yet" and ৳0.00 totals.

### 9. Tasks page throws a `TypeError` for partner users
- **Frontend:** `app/dashboard/tasks/page.tsx:89-93` unconditionally fetches admin-only `/api/users` on mount (no `.catch`) and calls `.filter()`:
  ```js
  fetch("/api/users")
    .then((res) => res.json())
    .then((data) => setPartners(data.filter((u) => u.role === "partner")));
  ```
- **Backend:** `app/api/users/route.ts:6-8` gates GET with `requireAdmin()`; non-admins get `{ error: "Forbidden" }` (403).
- **Mismatch:** For partners, `data` is an object, so `data.filter(...)` throws `TypeError: data.filter is not a function` (unhandled rejection on every partner visit).

### 10. Expense date filter ignored unless BOTH dates set
- **Frontend:** `app/dashboard/expenses/page.tsx:91-101` adds `from`/`to` independently and offers two separate `type="date"` inputs (`:228-239`).
- **Backend:** `app/api/expenses/route.ts:14`:
  ```ts
  const dateFilter = from && to ? sql`AND e.date BETWEEN ${from}::DATE AND ${to}::DATE` : sql``;
  ```
- **Mismatch:** Entering only a start (or only an end) date applies **no** filter and returns the full list.

### 11. Attendance punches misfiled near midnight
- **Frontend:** `app/dashboard/attendance/page.tsx:103` stores punches as UTC instants:
  ```js
  body: JSON.stringify({ activity, punched_at: new Date(punchTime).toISOString() })
  ```
- **Backend:** `app/api/attendance/route.ts:23` and `app/api/attendance/summary/route.ts:23` filter by `DATE(al.punched_at AT TIME ZONE 'UTC') = ${date}`, where `date` is a local `YYYY-MM-DD`.
- **Mismatch:** In UTC+6, punches at local 00:00–05:59 are stored on the previous UTC day and don't appear in the intended day's timeline/summary.

### 12. Validation errors render as `[object Object]` (recurring)
- **Backend:** returns `parsed.error.flatten().fieldErrors` (an object) under `error`.
- **Frontend:** passes it straight into `toast.error(...)`, which expects a string.
- **Sites confirmed:**
  - `app/api/partner-loans/[id]/repayments/route.ts:18-19` ↔ `app/dashboard/partner-loans/page.tsx:93-94`
  - `app/api/stock/adjustments/route.ts:59` ↔ `app/dashboard/stock/page.tsx:262-266`
  - `app/api/supplier-asset-returns/route.ts:43` ↔ `app/dashboard/stock/page.tsx:308-309`
- **Note:** reachability is low where the client pre-validates with the same schema, but the contract is genuinely mismatched. A shared error-extraction helper fixes all three at once.

---

## 🟡 Low severity

### 13. Orders "All" filter never shows cancelled orders
- **Frontend:** status dropdown offers "All" (`orders/page.tsx:846`) and separately "Cancelled" (`:850`); `apiStatus` passes `all` through.
- **Backend:** `app/api/orders/route.ts:14-16` maps `all` → `AND o.status NOT IN ('cancelled')`.
- **Mismatch:** Selecting "All" excludes cancelled orders (possibly intended "all active" semantics, but label ≠ behavior).

### 14. Suppliers "Show inactive" toggle hides all active suppliers
- **Frontend:** `app/dashboard/settings/suppliers/page.tsx:90` (switch labeled "Show inactive", `:169`):
  ```tsx
  fetch(`/api/settings/suppliers${showInactive ? "?inactive=true" : ""}`)
  ```
- **Backend:** `app/api/settings/suppliers/route.ts:11-13` returns **only** `is_active = false` when `inactive=true`.
- **Mismatch:** Flipping the toggle makes all active suppliers disappear instead of showing active + inactive.

### 15. `estimated_price` can silently no-op the purchase-request form
- **Frontend:** `app/dashboard/purchase-requests/page.tsx:907` registers with `{ valueAsNumber: true }`; the wrapping `<Field>` (`:902-909`) passes **no** `error` prop.
- **Schema:** `lib/schemas/purchase-request.ts:7` — `estimated_price: z.number().min(0).optional().nullable()` (Zod 4 rejects `NaN`).
- **Mismatch:** Typing then clearing the field yields `NaN` → resolver rejects → `handleSubmit` never fires, and with no error rendered the "Submit Request" button appears to do nothing. (Edge-conditional; untouched field stays `null` and works.)

### 16. Returns dropdown only lists delivered orders
- **Frontend:** `app/dashboard/returns/page.tsx:93-96` fetches `status=delivered` only (comment says "delivered/paid").
- **Backend:** `app/api/returns/route.ts:65` — `if (!["delivered", "paid"].includes(order.status))` — accepts returns for `paid` orders too.
- **Mismatch:** Paid orders (returnable server-side) can never be selected in the UI.

### 17. No server-side repayment cap on partner loans
- **Frontend:** `app/dashboard/partner-loans/page.tsx:229-233` caps the input via `max={Number(amount) - Number(repaid_amount)}`.
- **Backend:** `app/api/partner-loans/[id]/repayments/route.ts` validates only `amount >= 0.01` and never checks against outstanding balance (settles when `total_repaid >= loan.amount`, `:36`).
- **Mismatch:** A client bypassing the form (or with stale data) can overpay, producing a negative "Remaining" in the UI.

### 18. `asset-stock` columns typed `number` but returned as strings
- **Backend:** `lib/data/stock.ts:61-64` — `received`, `sent`, `returned_by_customers`, `returned_to_suppliers` are `COALESCE(SUM(...), 0)` (bigint → string, not coerced; only `available`/`unreturned` are `Number(...)`-coerced).
- **Frontend:** `app/dashboard/stock/page.tsx:78-88` declares all four as `number` and renders them raw (`:465-476`).
- **Mismatch:** Harmless today (display only), but the type annotation is false and any future arithmetic/comparison on these fields breaks silently.

---

## Recurring patterns worth fixing centrally

1. **Admin-gated in UI, unenforced in API** — #4, #5 (security holes), #8, #9 (broken UX). The frontend assumes admin-only, so several routes never re-check authorization.
2. **`[object Object]` toasts** — #12. A shared helper to extract a readable message from Zod `fieldErrors` fixes all three sites.
3. **"All" filter inversions** — #2, #13, #14. Off-by-one boolean logic in query filters.
4. **UTC vs. local dates** — #6, #11. `toISOString()` used where a local `YYYY-MM-DD` string is expected.

---

## Appendix — backend-only bugs (not strictly FE/BE contract mismatches)

Found during the audit; both sides agree on the API contract, but the backend logic is wrong.

- **Same-day records dropped by `timestamptz <= 'YYYY-MM-DD'` truncation** (comparison truncates to midnight, excluding today):
  - `lib/data/pnl.ts:29` and `:62` — `pr.purchased_at <= ${to}` (affects P&L and Settlement `net`/`payout`)
  - `app/api/reports/cash-flow/route.ts:24,32` — personal/total invested
  - `app/api/reports/investment-ledger/route.ts:15`
  - (Contrast: revenue/expenses correctly use `DATE(...) <= to`.)
- **`settlement/page.tsx:46` only handles 403, not 401** — `requireAdmin` returns 401 for an unauthenticated request; the page would then fall through to `r.json()`, set state to `undefined`, and `settlement.length` would throw (normally prevented by auth).

## Appendix — minor observations (no user-visible effect)

- **Customers page** — `Customer.partner_name` (`customers/page.tsx:61`) is declared non-optional but the non-admin `/api/customers` query omits the `u.name` join, so it's `undefined` at runtime. Harmless (never rendered) — inaccurate type only.
- **Cross-endpoint "due" semantics** — `/api/customers` computes `total_due` over all non-cancelled orders, while `/api/customers/[id]/history` sums only `delivered`/`paid` orders. Both are internally consistent with their own consumers, so not a FE/BE contract issue.
- **Partner-loans "Date" column** — renders `created_at` (`partner-loans/page.tsx:181`) rather than the business `loaned_at` date.
- **DATE/timezone display caveat** — `expenses.date` / `cash_remittances.submitted_at` rendered via `new Date(...).toLocaleDateString()` could show the previous day in timezones behind UTC, depending on how the driver serializes `DATE` columns (unverified without running).
