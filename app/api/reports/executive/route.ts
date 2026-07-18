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
          WHERE o.status IN ('delivered', 'paid') ${dateFilter}
          GROUP BY p.id, p.name
          ORDER BY p.name
        `
      : [];

  const [
    summary,
    customers,
    dailyTrend,
    products,
    expenseBreakdown,
    dues,
    supplies,
    miniDueList,
    assetOverview,
  ] = await Promise.all([
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
        WHERE o.status IN ('delivered', 'paid') ${productFilter} ${dateFilter}  -- FULFILLED: see lib/order-status.ts
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
      ),
      supplier_payment_stats AS (
        SELECT COALESCE(SUM(sp.amount), 0) AS total_supplier_paid
        FROM supplier_payments sp
        JOIN purchase_requests pr ON pr.id = sp.purchase_request_id
        WHERE pr.status = 'purchased' ${purchaseProductFilter} ${purchaseDateFilter}
      ),
      stock_stats AS (
        SELECT COALESCE(SUM(
          COALESCE(purchased.qty, 0)
          - COALESCE(reserved.qty, 0)
          - COALESCE(delivered.qty, 0)
          + COALESCE(returned.qty, 0)
          + COALESCE(adjusted.qty, 0)
        ), 0)::int AS total_stock
        FROM products p
        LEFT JOIN (SELECT product_id, SUM(actual_qty) AS qty FROM purchase_requests WHERE status = 'purchased' GROUP BY product_id) purchased ON purchased.product_id = p.id
        LEFT JOIN (SELECT product_id, SUM(quantity) AS qty FROM orders WHERE status = 'pending' GROUP BY product_id) reserved ON reserved.product_id = p.id
        LEFT JOIN (SELECT product_id, SUM(quantity) AS qty FROM orders WHERE status IN ('delivered', 'paid') GROUP BY product_id) delivered ON delivered.product_id = p.id
        LEFT JOIN (SELECT product_id, SUM(quantity) AS qty FROM returns GROUP BY product_id) returned ON returned.product_id = p.id
        LEFT JOIN (SELECT product_id, SUM(quantity) AS qty FROM stock_adjustments GROUP BY product_id) adjusted ON adjusted.product_id = p.id
        WHERE 1=1 ${productId && productId !== "all" ? sql`AND p.id = ${Number(productId)}` : sql``}
      )
      SELECT
        os.total_orders,
        os.total_qty,
        os.gross_revenue::numeric,
        os.total_collected::numeric,
        os.outstanding_due::numeric,
        os.active_customers,
        ps.total_purchase_cost::numeric,
        sps.total_supplier_paid::numeric,
        es.total_expenses::numeric,
        ls.total_loans_issued::numeric,
        ls.outstanding_loans::numeric,
        cs.total_customers,
        ss.total_suppliers,
        stk.total_stock,
        (os.gross_revenue - ps.total_purchase_cost - es.total_expenses)::numeric AS net_position
      FROM order_stats os, purchase_stats ps, expense_stats es, loan_stats ls, customer_stats cs, supplier_stats ss, supplier_payment_stats sps, stock_stats stk
    `,

    // (removed: Customer Performance, Daily Sales Trend, Product Performance)
    [] as Record<string, unknown>[],
    [] as Record<string, unknown>[],
    [] as Record<string, unknown>[],

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

    // Sheet 6: All Sales (one row per fulfilled order)
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
        COALESCE(o.net_value, 0)::numeric                        AS "Net Value",
        o.total_amount::numeric                                   AS "Sales",
        o.paid_amount::numeric                                    AS "Paid",
        o.due_amount::numeric                                     AS "Due",
        COALESCE(o.note, '')                                     AS "Remarks"
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN products p  ON p.id = o.product_id
      LEFT JOIN areas a ON a.id = c.area_id
      WHERE o.status IN ('delivered', 'paid') ${productFilter} ${dateFilter}  -- FULFILLED: see lib/order-status.ts
      ORDER BY o.ordered_at ASC
    `,

    // Sheet 7: Purchases
    sql`
      SELECT
        pr.purchased_at::date                                   AS "Date",
        CASE WHEN s.phone IS NOT NULL AND s.phone != '' THEN s.name || E'\n' || s.phone ELSE COALESCE(s.name, '—') END AS "Supplier",
        p.name                                                  AS "Product",
        REPLACE(COALESCE(pr.unit, p.unit), 'piece', 'pic')       AS "Unit",
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
        ), 0)::numeric                                          AS "S.Paid",
        (pr.actual_total - COALESCE((
          SELECT SUM(sp.amount)
          FROM supplier_payments sp
          WHERE sp.purchase_request_id = pr.id
        ), 0))::numeric                                         AS "Due",
        pr.remarks                                              AS "Remarks"
      FROM purchase_requests pr
      JOIN products p ON p.id = pr.product_id
      LEFT JOIN suppliers s ON s.id = pr.supplier_id
      WHERE pr.status = 'purchased' ${purchaseProductFilter} ${purchaseDateFilter}
      ORDER BY pr.purchased_at ASC
    `,

    // Sheet 8: Mini Due List (per-customer summary, grouped by area)
    // Include ALL non-cancelled orders for customers who have outstanding dues
    sql`
      SELECT
        COALESCE(a.name, 'No Area')                               AS "Area",
        c.name                                                    AS "Customer",
        COALESCE(c.phone, '')                                     AS "Phone",
        COALESCE(SUM(o.due_amount), 0)::numeric                   AS "Due",
        GREATEST(0,
          COALESCE(SUM((SELECT SUM(oa.quantity) FROM order_assets oa WHERE oa.order_id = o.id)), 0)
          - COALESCE(SUM((SELECT SUM(oar.quantity) FROM order_asset_returns oar WHERE oar.order_id = o.id)), 0)
        )::int                                                    AS "Asset",
        MAX(o.ordered_at)::date                                   AS "Last Order Date",
        ''                                                        AS "Remarks"
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN areas a ON a.id = c.area_id
      WHERE o.status IN ('delivered', 'paid') ${productFilter} ${dateFilter}  -- FULFILLED: see lib/order-status.ts
        AND c.id IN (
          SELECT o2.customer_id FROM orders o2
          WHERE o2.due_amount > 0 AND o2.status IN ('delivered', 'paid')
        )
      GROUP BY a.name, c.id, c.name, c.phone
      HAVING SUM(o.due_amount) > 0
      ORDER BY a.name NULLS LAST, SUM(o.due_amount) DESC
    `,

    // Sheet 9: Asset Overview — unreturned assets per customer + supplier return summary
    sql`
      SELECT
        c.name                           AS "Customer",
        COALESCE(c.phone, '')            AS "Phone",
        pa.name                          AS "Asset",
        p.name                           AS "Product",
        SUM(oa.quantity)::int            AS "Sent",
        COALESCE(SUM(oar.returned), 0)::int AS "Returned",
        (SUM(oa.quantity) - COALESCE(SUM(oar.returned), 0))::int AS "Unreturned"
      FROM order_assets oa
      JOIN orders o ON o.id = oa.order_id
      JOIN customers c ON c.id = o.customer_id
      JOIN product_assets pa ON pa.id = oa.asset_id
      JOIN products p ON p.id = pa.product_id
      LEFT JOIN LATERAL (
        SELECT SUM(oar2.quantity) AS returned
        FROM order_asset_returns oar2
        WHERE oar2.order_id = oa.order_id AND oar2.asset_id = oa.asset_id
      ) oar ON true
      WHERE o.status IN ('delivered', 'paid')
      GROUP BY c.id, c.name, c.phone, pa.id, pa.name, p.name
      HAVING SUM(oa.quantity) - COALESCE(SUM(oar.returned), 0) > 0
      ORDER BY c.name, pa.name
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

  // Purchase totals from supplies query
  const purchaseQty = supplies.reduce(
    (s: number, r: Record<string, unknown>) => s + Number(r["Qty"] ?? 0),
    0
  );
  const purchaseTotal = supplies.reduce(
    (s: number, r: Record<string, unknown>) => s + Number(r["Total"] ?? 0),
    0
  );
  const purchasePaid = supplies.reduce(
    (s: number, r: Record<string, unknown>) => s + Number(r["S.Paid"] ?? 0),
    0
  );
  const purchaseDue = supplies.reduce(
    (s: number, r: Record<string, unknown>) => s + Number(r["Due"] ?? 0),
    0
  );

  // Sales totals from dues (All Sales) query
  const salesQty = dues.reduce(
    (s: number, r: Record<string, unknown>) => s + Number(r["Qty"] ?? 0),
    0
  );
  const salesTotalCost = dues.reduce(
    (s: number, r: Record<string, unknown>) => s + Number(r["Total Cost"] ?? 0),
    0
  );
  const salesNetValue = dues.reduce(
    (s: number, r: Record<string, unknown>) => s + Number(r["Net Value"] ?? 0),
    0
  );
  const salesAmount = dues.reduce(
    (s: number, r: Record<string, unknown>) => s + Number(r["Sales"] ?? 0),
    0
  );
  const salesPaid = dues.reduce(
    (s: number, r: Record<string, unknown>) => s + Number(r["Paid"] ?? 0),
    0
  );
  const salesDue = dues.reduce(
    (s: number, r: Record<string, unknown>) => s + Number(r["Due"] ?? 0),
    0
  );

  const totalExpenses = Number(s?.total_expenses ?? 0);
  const totalStock = Number(s?.total_stock ?? 0);
  const avgPrice = salesQty > 0 ? salesAmount / salesQty : 0;
  const stockValue = totalStock * avgPrice;
  const actualCash = salesPaid - purchasePaid - totalExpenses;
  const cashInHand = salesDue + stockValue + actualCash;

  const summaryRows = s
    ? [
        { Metric: "Product", Value: productLabel },
        { Metric: "Period", Value: periodValue },
        { Metric: "", Value: "" },
        { Metric: "--- PURCHASES ---", Value: "" },
        { Metric: "Qty", Value: purchaseQty },
        { Metric: "Total", Value: purchaseTotal.toFixed(2) },
        { Metric: "Paid", Value: purchasePaid.toFixed(2) },
        { Metric: "Due", Value: purchaseDue.toFixed(2) },
        { Metric: "", Value: "" },
        { Metric: "--- STOCK ---", Value: "" },
        { Metric: "Current Stock Qty", Value: totalStock },
        { Metric: "Avg Selling Price", Value: avgPrice.toFixed(2) },
        { Metric: "Stock Value", Value: stockValue.toFixed(2) },
        { Metric: "", Value: "" },
        { Metric: "--- ALL SALES ---", Value: "" },
        { Metric: "Qty", Value: salesQty },
        { Metric: "Total Cost", Value: salesTotalCost.toFixed(2) },
        { Metric: "Net Value", Value: salesNetValue.toFixed(2) },
        { Metric: "Sales", Value: salesAmount.toFixed(2) },
        { Metric: "Paid", Value: salesPaid.toFixed(2) },
        { Metric: "Due", Value: salesDue.toFixed(2) },
        { Metric: "", Value: "" },
        { Metric: "--- EXPENSES ---", Value: "" },
        { Metric: "Total Expenses", Value: totalExpenses.toFixed(2) },
        { Metric: "", Value: "" },
        { Metric: "--- TOTAL SPENT ---", Value: "" },
        { Metric: "Supplier Paid", Value: purchasePaid.toFixed(2) },
        { Metric: "Expenses", Value: totalExpenses.toFixed(2) },
        { Metric: "= Total Spent", Value: (purchasePaid + totalExpenses).toFixed(2) },
        { Metric: "", Value: "" },
        { Metric: "--- TOTAL IN HAND ---", Value: "" },
        { Metric: "Collected", Value: salesPaid.toFixed(2) },
        { Metric: "+ Due from Customers", Value: salesDue.toFixed(2) },
        { Metric: "+ Stock Value", Value: stockValue.toFixed(2) },
        { Metric: "= Total In Hand", Value: (salesPaid + salesDue + stockValue).toFixed(2) },
        { Metric: "", Value: "" },
        { Metric: "--- PROFIT / LOSS ---", Value: "" },
        {
          Metric: "Total In Hand - Total Spent",
          Value: `${(salesPaid + salesDue + stockValue).toFixed(2)} - ${(purchasePaid + totalExpenses).toFixed(2)} = ${(salesPaid + salesDue + stockValue - purchasePaid - totalExpenses).toFixed(2)}`,
        },
      ]
    : [];

  const formattedDues = dues.map((r: Record<string, unknown>) => ({
    ...r,
    Date: fmt(r["Date"]),
  }));

  const formattedSupplies = supplies.map((r: Record<string, unknown>) => ({
    ...r,
    Date: fmt(r["Date"]),
  }));

  const formattedMiniDueList = miniDueList.map((r: Record<string, unknown>) => ({
    ...r,
    "Last Order Date": fmt(r["Last Order Date"]),
  }));

  return Response.json({
    summary: summaryRows,
    customers: [],
    dailyTrend: [],
    products: [],
    expenseBreakdown,
    dues: formattedDues,
    supplies: formattedSupplies,
    miniDueList: formattedMiniDueList,
    assetOverview,
  });
}
