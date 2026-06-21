import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Returns customers with outstanding due amounts
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user } = auth;

  const rows =
    user.role === "admin"
      ? await sql`
          SELECT
            c.id          AS customer_id,
            c.name        AS customer_name,
            c.phone       AS customer_phone,
            a.name        AS area_name,
            u.name        AS partner_name,
            SUM(o.due_amount) AS total_due,
            COUNT(o.id)   AS order_count
          FROM orders o
          JOIN customers c ON c.id = o.customer_id
          LEFT JOIN areas a ON a.id = c.area_id
          LEFT JOIN users u ON u.id = o.partner_id
          WHERE o.due_amount > 0
            AND o.status NOT IN ('cancelled')
          GROUP BY c.id, c.name, c.phone, a.name, u.name
          HAVING SUM(o.due_amount) > 0
          ORDER BY total_due DESC
        `
      : await sql`
          SELECT
            c.id          AS customer_id,
            c.name        AS customer_name,
            c.phone       AS customer_phone,
            a.name        AS area_name,
            SUM(o.due_amount) AS total_due,
            COUNT(o.id)   AS order_count
          FROM orders o
          JOIN customers c ON c.id = o.customer_id
          LEFT JOIN areas a ON a.id = c.area_id
          WHERE o.due_amount > 0
            AND o.status NOT IN ('cancelled')
            AND o.partner_id = ${user.id}
          GROUP BY c.id, c.name, c.phone, a.name
          HAVING SUM(o.due_amount) > 0
          ORDER BY total_due DESC
        `;

  return Response.json(rows);
}
