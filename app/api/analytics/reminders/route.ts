import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// GET /api/analytics/reminders
// Returns call-today list and overdue payment promises for the requesting partner (or any partner for admin)
export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;
  const url = new URL(request.url);
  const partnerIdParam = url.searchParams.get("partner_id");
  const targetId = user.role === "admin" && partnerIdParam ? Number(partnerIdParam) : user.id;

  const today = new Date().toISOString().slice(0, 10);

  // Customers due for delivery today (daily or matching interval), not paused
  const callToday = await sql`
    SELECT
      c.id,
      c.name,
      c.phone,
      c.whatsapp,
      c.delivery_frequency,
      c.delivery_interval,
      a.name AS area_name,
      COALESCE(SUM(o.due_amount), 0) AS outstanding_due
    FROM customers c
    LEFT JOIN areas a ON a.id = c.area_id
    LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'delivered'  -- HAS_DUE: see lib/order-status.ts
    WHERE c.partner_id = ${targetId}
      AND c.is_active = true
      AND c.is_paused = false
      AND (
        c.delivery_frequency = 'daily'
        OR (c.delivery_frequency = 'weekly'   AND EXTRACT(DOW FROM CURRENT_DATE) = 1)
        OR (c.delivery_frequency = 'biweekly' AND EXTRACT(DOW FROM CURRENT_DATE) = 1
            AND EXTRACT(WEEK FROM CURRENT_DATE)::int % 2 = 0)
        OR (c.delivery_frequency = 'monthly'  AND EXTRACT(DAY FROM CURRENT_DATE) = 1)
        OR c.delivery_frequency = 'custom'
      )
    GROUP BY c.id, c.name, c.phone, c.whatsapp, c.delivery_frequency, c.delivery_interval, a.name
    ORDER BY a.name ASC, c.name ASC
  `;

  // Orders with overdue promised payment date
  const paymentsDue = await sql`
    SELECT
      o.id AS order_id,
      o.promised_payment_date,
      o.due_amount,
      o.total_amount,
      c.id AS customer_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      a.name AS area_name
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    LEFT JOIN areas a ON a.id = c.area_id
    WHERE o.partner_id = ${targetId}
      AND o.due_amount > 0
      AND o.promised_payment_date IS NOT NULL
      AND o.promised_payment_date <= ${today}
      AND o.status = 'delivered'  -- HAS_DUE: see lib/order-status.ts
    ORDER BY o.promised_payment_date ASC
  `;

  return Response.json({ callToday, paymentsDue });
}
