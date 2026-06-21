# Phase 1 — Browser Testing Checklist

Run these in order. Each section must pass before moving to the next.

---

## 0. Setup & Auth

- [ ] Hit `/api/setup` in browser → response shows `{ ok: true, message: "Tables ready..." }`
- [ ] Go to `/login` → page loads without errors
- [ ] Login with wrong password → shows error toast
- [ ] Login with `admin@example.com` / `password123` → redirects to `/dashboard/overview`
- [ ] Go to `/login` while logged in → redirects to dashboard (or stays, no crash)
- [ ] Open a new tab, go to `/dashboard/overview` → loads (session persists)
- [ ] Click **Sign out** → redirects to `/login`
- [ ] After sign out, go to `/dashboard/overview` → redirects to `/login` (route protected)

---

## 1. Sidebar & Navigation

- [ ] Log in as admin → sidebar shows **Overview**, **Admin** section, **Settings** section
- [ ] **Admin** section contains: Users
- [ ] **Settings** section contains: Suppliers, Areas, Products, Pricing Tiers, Expense Categories, Payment Config
- [ ] Click each sidebar item → navigates to correct page without crash
- [ ] Active nav item is highlighted
- [ ] Collapse sidebar (click trigger) → icons only mode works
- [ ] Expand sidebar again → labels show

---

## 2. Users Page (`/dashboard/users`)

- [ ] Page loads, shows admin user in table
- [ ] Click **Add User** → right sheet opens
- [ ] Fill name, email, password, role = Partner → click **Create** → user appears in table
- [ ] Fill name, email only (no password) → shows validation error "Password must be at least 6 characters"
- [ ] Try duplicate email → shows error "Email already in use"
- [ ] Role dropdown shows **Partner** and **Admin** options (not "User")
- [ ] Admin user row → **no action buttons** (edit/delete/login hidden for admin)
- [ ] Partner user row → shows LogIn, Edit, Delete buttons
- [ ] Click **Edit** on partner → sheet opens pre-filled with their data
- [ ] Change name → Save → table updates
- [ ] Leave password blank on edit → saves without changing password (can still login)
- [ ] Click **Delete** on partner → user removed from table
- [ ] Click **LogIn** on a partner → switches to their account, redirects to overview
- [ ] After impersonation → sign out → log back in as admin

---

## 3. Suppliers (`/dashboard/settings/suppliers`)

- [ ] Page loads, table shows empty state
- [ ] Click **Add Supplier** → sheet opens with all fields visible
- [ ] Submit with name empty → validation error "Name is required"
- [ ] Fill only **Name** → saves successfully (all other fields optional)
- [ ] Supplier appears in table with correct columns: Name, Contact, Phone, bKash, Default Price, Active
- [ ] Click **Edit** → sheet opens pre-filled
- [ ] Change a field → Save → table updates
- [ ] Click **Deactivate** (power icon) → supplier disappears from table (soft delete)
- [ ] Toggle **Show inactive** → deactivated supplier reappears with Inactive badge
- [ ] Create a supplier with all fields filled (phone, whatsapp, bkash, nagad, bank, etc.) → saves correctly
- [ ] Invalid email in email field → validation error

---

## 4. Areas (`/dashboard/settings/areas`)

- [ ] Page loads, table shows empty state
- [ ] Click **Add Area** → sheet opens
- [ ] Submit with name empty → validation error
- [ ] Fill Name + Description → Create → area appears in table
- [ ] After create, sheet stays open in **Edit mode** (ready for partner assignment)
- [ ] **Partner Assignment** section shows "No partner assigned"
- [ ] Partner dropdown shows the partner user created in step 2 (not admin)
- [ ] Select partner → click **Assign** → partner name appears in the assignment list
- [ ] Close sheet → area row in table shows assigned partner name as badge
- [ ] Open area again → click **X** on assigned partner → partner removed
- [ ] Assign a different partner → replaces previous assignment (not duplicated)
- [ ] Click **Deactivate** → area disappears
- [ ] Toggle Show inactive → area reappears as Inactive

---

## 5. Products (`/dashboard/settings/products`)

- [ ] Page loads, table shows empty state
- [ ] Click **Add Product** → sheet opens
- [ ] Submit empty → validation error on Name and Unit
- [ ] Fill Name = "Egg", Unit = "piece", Default Price = 12, Low Stock Threshold = 100 → Create
- [ ] Product appears in table
- [ ] Edit product → change price → Save → table updates
- [ ] Deactivate product → disappears from table
- [ ] Toggle Show inactive → product shows as Inactive

---

## 6. Pricing Tiers (`/dashboard/settings/pricing-tiers`)

- [ ] Page loads, table shows empty state
- [ ] Product filter dropdown at top shows "Egg" (from step 5)
- [ ] Click **Add Tier** → sheet opens
- [ ] Submit empty → validation errors on Product, Name, Unit Price
- [ ] Fill: Product = Egg, Name = Regular, Unit Price = 12, Min Qty = 1 → Create
- [ ] Tier appears in table with product name shown
- [ ] Add second tier: Name = Bulk, Unit Price = 11, Min Qty = 50 → Create
- [ ] Both tiers show in table
- [ ] Filter by product → only Egg tiers shown
- [ ] Edit a tier → change price → Save → updates
- [ ] Delete a tier → removed (hard delete, no soft delete here)
- [ ] **Delete protection:** assign this tier to a customer first (skip for now — test after Phase 2), then try delete → should get error "assigned to one or more customers"

---

## 7. Expense Categories (`/dashboard/settings/expense-categories`)

- [ ] Page loads, table shows empty state
- [ ] Click **Add Category** → sheet opens
- [ ] Submit empty → validation error on Name
- [ ] Fill Name = "Fuel", Icon = "⛽" → Create → appears in table
- [ ] Add a few more: Packaging 📦, Labour 👷, Misc 🔧
- [ ] Edit a category → change name/icon → Save → updates
- [ ] Delete a category → removed
- [ ] **Delete protection:** will block if category has expenses (test after Phase 3)

---

## 8. Payment Config (`/dashboard/settings/payment-config`)

- [ ] Page loads, shows form with current values (defaults: due allowed ON, max due 1000, late punch 09:30, low stock 100)
- [ ] Toggle **Due Allowed** off → click Save → success toast
- [ ] Reload page → Due Allowed shows as OFF (persisted)
- [ ] Toggle back ON → save
- [ ] Change **Max Due Per Customer** to 500 → save → reload → shows 500
- [ ] Change **Late Punch Threshold** to "10:00" → save → reload → shows 10:00
- [ ] Enter invalid time format (e.g. "25:00") → validation error
- [ ] Change **Low Stock Default** to 50 → save → reload → shows 50

---

## 9. Role Check — Partner View

Create a partner user and log in as them to confirm they cannot access admin pages.

- [ ] Log in as the partner user (or use impersonation from Users page)
- [ ] Sidebar shows **Overview** only — no Admin section, no Settings section
- [ ] Manually navigate to `/dashboard/settings/suppliers` → should show "Forbidden" or redirect
- [ ] Manually navigate to `/dashboard/users` → should show "Forbidden" or redirect
- [ ] Sign out → log back in as admin

---

## Sign-off

| Section               | Pass | Notes |
| --------------------- | ---- | ----- |
| 0. Setup & Auth       | ☐    |       |
| 1. Sidebar & Nav      | ☐    |       |
| 2. Users              | ☐    |       |
| 3. Suppliers          | ☐    |       |
| 4. Areas              | ☐    |       |
| 5. Products           | ☐    |       |
| 6. Pricing Tiers      | ☐    |       |
| 7. Expense Categories | ☐    |       |
| 8. Payment Config     | ☐    |       |
| 9. Partner Role Check | ☐    |       |

**Phase 1 complete when all rows above are checked. Then start Phase 2.**
