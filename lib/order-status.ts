/**
 * Centralized order status filters — single source of truth.
 *
 * RULES:
 * ─────────────────────────────────────────────────────────────────
 * FULFILLED  = ('delivered', 'paid')
 *   Use for: revenue, paid totals, due totals, cost, net value,
 *            qty sold, stock consumption, customer totals.
 *   Reason:  pending orders are not yet fulfilled — they should
 *            NOT count in financial totals.
 *
 * HAS_DUE    = ('delivered')
 *   Use for: outstanding dues lists, debtor counts, mini due list.
 *   Reason:  only delivered orders can carry a balance. Paid orders
 *            have zero due by definition (status transitions to
 *            'paid' when due reaches zero).
 *
 * ACTIVE     = NOT IN ('cancelled')
 *   Use for: order counts visible in tables, calendar order lists.
 *   Reason:  pending orders are real orders — show them in lists,
 *            but NOT in financial aggregates.
 * ─────────────────────────────────────────────────────────────────
 *
 * SQL usage with neon tagged templates:
 *   import { FULFILLED, HAS_DUE } from "@/lib/order-status";
 *   sql`... WHERE ${FULFILLED} ...`      // o.status IN ('delivered','paid')
 *   sql`... WHERE ${HAS_DUE} ...`        // o.status = 'delivered'
 *
 * Plain SQL snippets (for embedding in raw strings):
 *   FULFILLED_SQL, HAS_DUE_SQL
 */

// ── SQL snippet strings (for documentation / reference) ──────────

/** Orders that count toward financial totals */
export const FULFILLED_SQL = "o.status IN ('delivered', 'paid')";

/** Orders that can carry outstanding dues */
export const HAS_DUE_SQL = "o.status = 'delivered'";

/** Orders visible in lists (non-cancelled) */
export const ACTIVE_SQL = "o.status NOT IN ('cancelled')";

// ── Status arrays (for JS-side filtering) ────────────────────────

/** Statuses that count as fulfilled (for JS filtering) */
export const FULFILLED_STATUSES = ["delivered", "paid"] as const;

/** Statuses that can have outstanding dues (for JS filtering) */
export const HAS_DUE_STATUSES = ["delivered"] as const;
