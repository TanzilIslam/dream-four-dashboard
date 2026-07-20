import { sql } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const { customer_id, phone } = body;

  if (!customer_id || !phone) {
    return Response.json({ error: "Missing customer_id or phone" }, { status: 400 });
  }

  // Fetch customer
  const [customerRow] = await sql`
    SELECT id, name, phone, address
    FROM customers
    WHERE id = ${customer_id}
    AND is_active = true
  `;

  if (!customerRow) {
    return Response.json({ error: "Customer not found" }, { status: 404 });
  }

  const customer = {
    id: customerRow.id as number,
    name: customerRow.name as string,
    phone: customerRow.phone as string | null,
    address: customerRow.address as string,
  };

  // Verify phone number (check last 2 digits or full match)
  const customerPhoneLastTwo = customer.phone ? customer.phone.slice(-2) : null;
  const phoneLastTwo = phone.slice(-2);

  if (customerPhoneLastTwo !== phoneLastTwo) {
    return Response.json({ error: "Phone number does not match" }, { status: 401 });
  }

  // Fetch orders
  const orders = await sql`
    SELECT
      o.id,
      o.quantity,
      o.unit_price,
      o.ordered_at,
      o.status,
      p.name as product_name,
      p.unit as product_unit
    FROM orders o
    LEFT JOIN products p ON p.id = o.product_id
    WHERE o.customer_id = ${customer_id}
    ORDER BY o.ordered_at DESC
    LIMIT 50
  `;

  // Fetch payments
  const payments = await sql`
    SELECT
      id,
      amount,
      payment_method,
      paid_at
    FROM payments
    WHERE order_id IN (SELECT id FROM orders WHERE customer_id = ${customer_id})
    ORDER BY paid_at DESC
    LIMIT 50
  `;

  // Calculate total ordered and total paid
  const totalOrdered = orders.reduce((sum, order) => sum + (Number(order.unit_price) * Number(order.quantity)), 0);
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  return Response.json({
    customer: {
      id: customer.id,
      name: customer.name,
      address: customer.address,
    },
    orders,
    payments,
    summary: {
      total_ordered: totalOrdered,
      total_paid: totalPaid,
      total_due: totalOrdered - totalPaid,
    },
  });
}
