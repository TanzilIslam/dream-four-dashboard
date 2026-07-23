import { sql } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = url.searchParams.get("name");

  if (!name || name.trim().length < 2) {
    return Response.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const customers = await sql`
    SELECT id, name, phone
    FROM customers
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(${name}))
    AND is_active = true
    LIMIT 10
  `;

  if (customers.length === 0) {
    return Response.json({ error: "No customers found" }, { status: 404 });
  }

  // Mask phone numbers to show only last 2 digits
  const maskedCustomers = customers.map((customer) => {
    const id = customer.id as number;
    const name = customer.name as string;
    const phone = customer.phone as string | null;
    return {
      id,
      name,
      phone_masked: phone ? `****${phone.slice(-2)}` : null,
      phone_last_two: phone ? phone.slice(-2) : null,
    };
  });

  return Response.json(maskedCustomers);
}
