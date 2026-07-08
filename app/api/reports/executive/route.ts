import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const productFilter =
    productId && productId !== "all" ? sql`AND o.product_id = ${Number(productId)}` : sql``;
  const dateFilter =
    from && to
      ? sql`AND o.ordered_at::date BETWEEN ${from} AND ${to}`
      : from
        ? sql`AND o.ordered_at::date >= ${from}`
        : to
          ? sql`AND o.ordered_at::date <= ${to}`
          : sql``;
  const expenseDateFilter =
    from && to
      ? sql`WHERE e.date BETWEEN ${from} AND ${to}`
      : from
        ? sql`WHERE e.date >= ${from}`
        : to
          ? sql`WHERE e.date <= ${to}`
          : sql``;
  const purchaseDateFilter =
    from && to
      ? sql`AND pr.purchased_at::date BETWEEN ${from} AND ${to}`
      : from
        ? sql`AND pr.purchased_at::date >= ${from}`
        : to
          ? sql`AND pr.purchased_at::date <= ${to}`
          : sql``;
  const purchaseProductFilter =
    productId && productId !== "all" ? sql`AND pr.product_id = ${Number(productId)}` : sql``;
  const loanDateFilter =
    from && to
      ? sql`AND sl.loaned_at BETWEEN ${from}::DATE AND ${to}::DATE`
      : from
        ? sql`AND sl.loaned_at >= ${from}::DATE`
        : to
          ? sql`AND sl.loaned_at <= ${to}::DATE`
          : sql``;

  const productNameResult =
    productId && productId !== "all"
      ? await sql`SELECT name FROM products WHERE id = ${Number(productId)} LIMIT 1`
      : await sql`SELECT name FROM products ORDER BY name`;
  const productLabel =
    productId && productId !== "all"
      ? (productNameResult[0] as { name: string }).name
      : productNameResult.map((p: Record<string, unknown>) => p.name as string).join(", ");

  // Ensure simple_loans table exists (created lazily by /api/loans)
  await sql`
    CREATE TABLE IF NOT EXISTS simple_loans (
      id          SERIAL PRIMARY KEY,
      person_name TEXT    NOT NULL,
      amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      reason      TEXT,
      note        TEXT,
      loaned_at   DATE    NOT NULL DEFAULT CURRENT_DATE,
      status      TEXT    NOT NULL DEFAULT 'outstanding',
      returned_at DATE,
      created_by  INTEGER REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Earliest order date for period display when no `from` is given
  const minDateProductFilter =
    productId && productId !== "all" ? sql`AND product_id = ${Number(productId)}` : sql``;
  const [{ earliest_date }] = await sql`
    SELECT MIN(ordered_at)::date AS earliest_date FROM orders
    WHERE status != 'cancelled'
      AND ordered_at >= NOW() - INTERVAL '2 years'
      ${minDateProductFilter}
  `;
  const actualFrom: Date | string | null = from ?? earliest_date ?? null;
  const actualTo: Date | string = to ?? new Date();

  // Per-product order/qty breakdown when all products selected
  const perProductStats =
    !productId || productId === "all"
      ? await sql`
          SELECT p.name,
                 COUNT(o.id)::int                    AS orders,
                 COALESCE(SUM(o.quantity), 0)::int   AS qty
          FROM orders o
          JOIN products p ON p.id = o.product_id
          WHERE o.status != 'cancelled' ${dateFilter}
          GROUP BY p.id, p.name
          ORDER BY p.name
        `
      : [];

  const [summary, customers, dailyTrend, products, expenseBreakdown, dues, supplies, miniDueList] =
    await Promise.all([
      // Sheet 1: Summary KPIs
      sql`
      WITH order_stats AS (
        SELECT
          COUNT(*)::int                    AS total_orders,
          COALESCE(SUM(o.quantity), 0)::int AS total_qty,
          COALESCE(SUM(o.total_amount), 0)  AS gross_revenue,
          COALESCE(SUM(o.paid_amount), 0)   AS total_collected,
          COALESCE(SUM(o.due_amount), 0)    AS outstanding_due,
          COUNT(DISTINCT o.customer_id)::int AS active_customers
        FROM orders o
        WHERE o.status != 'cancelled' ${productFilter} ${dateFilter}
      ),
      purchase_stats AS (
        SELECT COALESCE(SUM(pr.actual_total), 0) AS total_purchase_cost
        FROM purchase_requests pr
        WHERE pr.status = 'purchased' ${purchaseProductFilter} ${purchaseDateFilter}
      ),
      expense_stats AS (
        SELECT COALESCE(SUM(e.amount), 0) AS total_expenses
        FROM expenses e ${expenseDateFilter}
      ),
      loan_stats AS (
        SELECT
          COALESCE(SUM(sl.amount), 0)                                          AS total_loans_issued,
          COALESCE(SUM(sl.amount) FILTER (WHERE sl.status = 'outstanding'), 0) AS outstanding_loans
        FROM simple_loans sl
        WHERE 1=1 ${loanDateFilter}
      ),
      customer_stats AS (
        SELECT COUNT(*)::int AS total_customers FROM customers WHERE is_active = true
      ),
      supplier_stats AS (
        SELECT COUNT(*)::int AS total_suppliers FROM suppliers WHERE is_active = true
      )
      SELECT
        os.total_orders,
        os.total_qty,
        os.gross_revenue::numeric,
        os.total_collected::numeric,
        os.outstanding_due::numeric,
        os.active_customers,
        ps.total_purchase_cost::numeric,
        es.total_expenses::numeric,
        ls.total_loans_issued::numeric,
        ls.outstanding_loans::numeric,
        cs.total_customers,
        ss.total_suppliers,
        (os.gross_revenue - ps.total_purchase_cost - es.total_expenses)::numeric AS net_position
      FROM order_stats os, purchase_stats ps, expense_stats es, loan_stats ls, customer_stats cs, supplier_stats ss
    `,

      // Sheet 2: Customer Performance
      sql`
      SELECT
        o.ordered_at::date                                        AS "Date",
        CASE WHEN c.phone IS NOT NULL AND c.phone != '' THEN c.name || E'\n' || c.phone ELSE c.name END AS "Customer",
        p.name                                                    AS "Product",
        COALESCE(o.unit, p.unit)                                  AS "Unit",
        COALESCE(o.unit_cost, 0)::numeric                        AS "Unit Cost",
        COALESCE(o.unit_transport_cost, 0)::numeric              AS "Transport Cost",
        COALESCE(o.unit_label_cost, 0)::numeric                  AS "Label Cost",
        COALESCE(o.unit_other_cost, 0)::numeric                  AS "Other Cost",
        o.quantity::int                                           AS "Qty",
        COALESCE(o.total_cost, 0)::numeric                       AS "Total Cost",
        o.total_amount::numeric                                   AS "Sales",
        COALESCE(o.net_value, 0)::numeric                        AS "Net Value",
        o.due_amount::numeric                                     AS "Due",
        COALESCE((SELECT SUM(py.amount) FROM payments py WHERE py.order_id = o.id), 0)::numeric AS "Due Collection",
        COALESCE(o.collection, 0)::numeric                       AS "Collection",
        COALESCE(o.note, '')                                     AS "Remarks"
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN products p  ON p.id = o.product_id
      LEFT JOIN areas a ON a.id = c.area_id
      WHERE o.status != 'cancelled' ${productFilter} ${dateFilter}
      ORDER BY o.ordered_at ASC
    `,

      // Sheet 3: Daily Sales Trend
      sql`
      SELECT
        o.ordered_at::date                        AS "Date",
        COUNT(o.id)::int                          AS "Orders",
        COALESCE(SUM(o.quantity), 0)::int         AS "Qty",
        COALESCE(SUM(o.total_amount), 0)::numeric AS "Revenue (৳)",
        COALESCE(SUM(o.paid_amount), 0)::numeric  AS "Collected (৳)"
      FROM orders o
      WHERE o.status != 'cancelled' ${productFilter} ${dateFilter}
      GROUP BY o.ordered_at::date
      ORDER BY o.ordered_at::date
    `,

      // Sheet 4: Product Performance
      sql`
      SELECT
        p.name                                                AS "Product",
        COALESCE(SUM(o.quantity) FILTER (WHERE o.status != 'cancelled'), 0)::int        AS "Qty Sold",
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.status != 'cancelled'), 0)::numeric AS "Revenue (৳)",
        COALESCE((SELECT SUM(pr.actual_total) FROM purchase_requests pr WHERE pr.product_id = p.id AND pr.status = 'purchased'), 0)::numeric AS "Purchase Cost (৳)",
        (
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status != 'cancelled'), 0)
          - COALESCE((SELECT SUM(pr.actual_total) FROM purchase_requests pr WHERE pr.product_id = p.id AND pr.status = 'purchased'), 0)
        )::numeric AS "Gross Profit (৳)",
        CASE
          WHEN COALESCE(SUM(o.total_amount) FILTER (WHERE o.status != 'cancelled'), 0) = 0 THEN '0%'
          ELSE ROUND(
            100 * (
              COALESCE(SUM(o.total_amount) FILTER (WHERE o.status != 'cancelled'), 0)
              - COALESCE((SELECT SUM(pr.actual_total) FROM purchase_requests pr WHERE pr.product_id = p.id AND pr.status = 'purchased'), 0)
            ) / COALESCE(SUM(o.total_amount) FILTER (WHERE o.status != 'cancelled'), 1)
          )::text || '%'
        END AS "Margin %"
      FROM products p
      LEFT JOIN orders o ON o.product_id = p.id ${dateFilter}
      ${productId && productId !== "all" ? sql`WHERE p.id = ${Number(productId)}` : sql``}
      GROUP BY p.id, p.name
      ORDER BY SUM(o.total_amount) DESC NULLS LAST
    `,

      // Sheet 5: Expense Breakdown
      sql`
      SELECT
        COALESCE(ec.name, 'Uncategorized')                      AS "Category",
        COALESCE(p.name, 'Common (No Product)')                 AS "Product",
        COALESCE(SUM(e.amount), 0)::numeric                     AS "Amount (৳)",
        ROUND(100 * SUM(e.amount) / NULLIF(SUM(SUM(e.amount)) OVER (), 0))::text || '%' AS "% of Total"
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      LEFT JOIN products p            ON p.id = e.product_id
      ${expenseDateFilter}
      GROUP BY ec.id, ec.name, p.id, p.name
      ORDER BY SUM(e.amount) DESC
    `,

      // Sheet 6: Outstanding Dues (one row per order with due > 0)
      sql`
      SELECT
        o.ordered_at::date                                        AS "Date",
        CASE WHEN c.phone IS NOT NULL AND c.phone != '' THEN c.name || E'\n' || c.phone ELSE c.name END AS "Customer",
        p.name                                                    AS "Product",
        COALESCE(o.unit, p.unit)                                  AS "Unit",
        COALESCE(o.unit_cost, 0)::numeric                        AS "Unit Cost",
        COALESCE(o.unit_transport_cost, 0)::numeric              AS "Transport Cost",
        COALESCE(o.unit_label_cost, 0)::numeric                  AS "Label Cost",
        COALESCE(o.unit_other_cost, 0)::numeric                  AS "Other Cost",
        o.quantity::int                                           AS "Qty",
        COALESCE(o.total_cost, 0)::numeric                       AS "Total Cost",
        o.total_amount::numeric                                   AS "Sales",
        COALESCE(o.net_value, 0)::numeric                        AS "Net Value",
        o.due_amount::numeric                                     AS "Due",
        COALESCE((SELECT SUM(py.amount) FROM payments py WHERE py.order_id = o.id), 0)::numeric AS "Due Collection",
        COALESCE(o.collection, 0)::numeric                       AS "Collection",
        COALESCE(o.note, '')                                     AS "Remarks"
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN products p  ON p.id = o.product_id
      LEFT JOIN areas a ON a.id = c.area_id
      WHERE o.due_amount > 0 AND o.status != 'cancelled' ${productFilter} ${dateFilter}
      ORDER BY o.ordered_at ASC
    `,

      // Sheet 7: Purchases
      sql`
      SELECT
        pr.purchased_at::date                                   AS "Date",
        CASE WHEN s.phone IS NOT NULL AND s.phone != '' THEN s.name || E'\n' || s.phone ELSE COALESCE(s.name, '—') END AS "Supplier",
        p.name                                                  AS "Product",
        COALESCE(pr.unit, p.unit)                               AS "Unit",
        pr.actual_price::numeric                                AS "Unit Price",
        COALESCE(pr.unit_transport_cost, 0)::numeric            AS "Transport Cost",
        COALESCE(pr.unit_label_cost, 0)::numeric                AS "Label Cost",
        COALESCE(pr.unit_other_cost, 0)::numeric                AS "Others Cost",
        (pr.actual_price + COALESCE(pr.unit_transport_cost, 0) + COALESCE(pr.unit_label_cost, 0) + COALESCE(pr.unit_other_cost, 0))::numeric AS "Actual Unit Cost",
        pr.actual_qty::int                                      AS "Qty",
        pr.actual_total::numeric                                AS "Total",
        COALESCE((
          SELECT SUM(sp.amount)
          FROM supplier_payments sp
          WHERE sp.purchase_request_id = pr.id
        ), 0)::numeric                                          AS "Paid",
        (pr.actual_total - COALESCE((
          SELECT SUM(sp.amount)
          FROM supplier_payments sp
          WHERE sp.purchase_request_id = pr.id
        ), 0))::numeric                                         AS "Due",
        pr.note                                                 AS "Note",
        pr.remarks                                              AS "Remarks"
      FROM purchase_requests pr
      JOIN products p ON p.id = pr.product_id
      LEFT JOIN suppliers s ON s.id = pr.supplier_id
      WHERE pr.status = 'purchased' ${purchaseProductFilter} ${purchaseDateFilter}
      ORDER BY pr.purchased_at DESC
    `,

      // Sheet 8: Mini Due List (per-customer summary)
      // Include ALL non-cancelled orders for customers who have outstanding dues
      sql`
      SELECT
        c.name                                                    AS "Customer",
        COALESCE(c.phone, '')                                     AS "Phone",
        COALESCE(SUM(o.total_amount), 0)::numeric                 AS "Total",
        (COALESCE(SUM(o.total_amount), 0) - COALESCE(SUM(o.due_amount), 0))::numeric AS "Paid",
        COALESCE(SUM(o.due_amount), 0)::numeric                   AS "Due",
        GREATEST(0,
          COALESCE(SUM((SELECT SUM(oa.quantity) FROM order_assets oa WHERE oa.order_id = o.id)), 0)
          - COALESCE(SUM((SELECT SUM(oar.quantity) FROM order_asset_returns oar WHERE oar.order_id = o.id)), 0)
        )::int                                                    AS "Asset",
        MAX(o.ordered_at)::date                                   AS "Last Order Date",
        ''                                                        AS "Remarks"
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE o.status != 'cancelled' ${productFilter} ${dateFilter}
        AND c.id IN (
          SELECT o2.customer_id FROM orders o2
          WHERE o2.due_amount > 0 AND o2.status != 'cancelled'
        )
      GROUP BY c.id, c.name, c.phone
      HAVING SUM(o.due_amount) > 0
      ORDER BY SUM(o.due_amount) DESC
    `,
    ]);

  const fmt = (d: unknown) =>
    d
      ? new Date(d as string).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "2-digit",
        })
      : "—";

  // Format summary as a label-value table for Excel
  const s = summary[0];

  const daysDiff =
    actualFrom && actualTo
      ? Math.round(
          (new Date(actualTo).getTime() - new Date(actualFrom).getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      : null;
  const periodValue = actualFrom
    ? `${fmt(actualFrom)} – ${fmt(actualTo)}${daysDiff !== null ? ` (${daysDiff} Days)` : ""}`
    : "All Time";

  const formatBreakdown = (key: "orders" | "qty", total: number): string => {
    if ((perProductStats as Record<string, unknown>[]).length === 0) return String(total);
    const parts = (perProductStats as Record<string, unknown>[])
      .map((p) => `${p.name}: ${p[key]}`)
      .join(" | ");
    return `${parts} | Total: ${total}`;
  };

  const summaryRows = s
    ? [
        { Metric: "Product", Value: productLabel },
        { Metric: "Period", Value: periodValue },
        { Metric: "Total Orders", Value: formatBreakdown("orders", s.total_orders as number) },
        { Metric: "Total Qty Sold", Value: formatBreakdown("qty", s.total_qty as number) },
        { Metric: "Total Customers", Value: s.total_customers },
        { Metric: "Total Suppliers", Value: s.total_suppliers },
        // { Metric: "Gross Revenue (৳)", Value: Number(s.gross_revenue).toFixed(2) },
        // { Metric: "Total Collected (৳)", Value: Number(s.total_collected).toFixed(2) },
        // { Metric: "Outstanding Due (৳)", Value: Number(s.outstanding_due).toFixed(2) },
        // { Metric: "Active Customers", Value: s.active_customers },
        // { Metric: "Purchase Cost (৳)", Value: Number(s.total_purchase_cost).toFixed(2) },
        // { Metric: "Gross Profit (৳)", Value: Number(s.gross_profit).toFixed(2) },
        // { Metric: "Total Expenses (৳)", Value: Number(s.total_expenses).toFixed(2) },
        // { Metric: "Net Position (৳)", Value: Number(s.net_position).toFixed(2) },
        { Metric: "Total Purchased (৳)", Value: Number(s.total_purchase_cost).toFixed(2) },
        { Metric: "Total Sell (৳)", Value: Number(s.gross_revenue).toFixed(2) },
        { Metric: "Total Due (৳)", Value: Number(s.outstanding_due).toFixed(2) },
        { Metric: "Total Expenses (৳)", Value: Number(s.total_expenses).toFixed(2) },
        { Metric: "Total Loans Issued (৳)", Value: Number(s.total_loans_issued).toFixed(2) },
        {
          Metric: "Total Net Profit (৳)",
          Value: `Sell - Purchased - Expenses = ${Number(s.net_position).toFixed(2)}`,
        },
      ]
    : [];

  const formattedDailyTrend = dailyTrend.map((r: Record<string, unknown>) => ({
    ...r,
    Date: fmt(r["Date"]),
  }));

  const formattedDues = dues.map((r: Record<string, unknown>) => ({
    ...r,
    Date: fmt(r["Date"]),
  }));

  const formattedSupplies = supplies.map((r: Record<string, unknown>) => ({
    ...r,
    Date: fmt(r["Date"]),
  }));

  const formattedCustomers = customers.map((r: Record<string, unknown>) => ({
    ...r,
    Date: fmt(r["Date"]),
  }));

  const formattedMiniDueList = miniDueList.map((r: Record<string, unknown>) => ({
    ...r,
    "Last Order Date": fmt(r["Last Order Date"]),
  }));

  return Response.json({
    summary: summaryRows,
    customers: formattedCustomers,
    dailyTrend: formattedDailyTrend,
    products,
    expenseBreakdown,
    dues: formattedDues,
    supplies: formattedSupplies,
    miniDueList: formattedMiniDueList,
  });
}
