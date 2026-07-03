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

  const productNameResult =
    productId && productId !== "all"
      ? await sql`SELECT name FROM products WHERE id = ${Number(productId)} LIMIT 1`
      : [];
  const productLabel =
    productNameResult.length > 0 ? (productNameResult[0] as { name: string }).name : "All Products";

  const [summary, customers, dailyTrend, products, expenseBreakdown, dues, supplies] =
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
      )
      SELECT
        os.total_orders,
        os.total_qty,
        os.gross_revenue::numeric,
        os.total_collected::numeric,
        os.outstanding_due::numeric,
        os.active_customers,
        ps.total_purchase_cost::numeric,
        (os.gross_revenue - ps.total_purchase_cost)::numeric AS gross_profit,
        es.total_expenses::numeric,
        (os.gross_revenue - ps.total_purchase_cost - es.total_expenses)::numeric AS net_position
      FROM order_stats os, purchase_stats ps, expense_stats es
    `,

      // Sheet 2: Customer Performance
      sql`
      SELECT
        c.name                                  AS "Customer",
        COALESCE(a.name, '—')                   AS "Area",
        COUNT(o.id)::int                        AS "Orders",
        COALESCE(SUM(o.quantity), 0)::int       AS "Qty Sold",
        COALESCE(SUM(o.total_amount), 0)::numeric AS "Revenue (৳)",
        COALESCE(SUM(o.paid_amount), 0)::numeric  AS "Collected (৳)",
        COALESCE(SUM(o.due_amount), 0)::numeric   AS "Due (৳)",
        GREATEST(0,
          COALESCE((SELECT SUM(oa.quantity) FROM order_assets oa JOIN orders ox ON ox.id = oa.order_id WHERE ox.customer_id = c.id), 0)
          - COALESCE((SELECT SUM(oar.quantity) FROM order_asset_returns oar JOIN orders ox ON ox.id = oar.order_id WHERE ox.customer_id = c.id), 0)
        )::int AS "Unreturned Assets"
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN areas a ON a.id = c.area_id
      WHERE o.status != 'cancelled' ${productFilter} ${dateFilter}
      GROUP BY c.id, c.name, a.name
      ORDER BY SUM(o.total_amount) DESC
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

      // Sheet 6: Outstanding Dues
      sql`
      SELECT
        c.name                                   AS "Customer",
        COALESCE(a.name, '—')                    AS "Area",
        COALESCE(SUM(o.due_amount), 0)::numeric  AS "Due (৳)",
        COUNT(o.id)::int                         AS "Orders",
        MAX(o.ordered_at)::date                  AS "Last Order"
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN areas a ON a.id = c.area_id
      WHERE o.status = 'delivered' AND o.due_amount > 0 ${productFilter} ${dateFilter}
      GROUP BY c.id, c.name, a.name
      HAVING SUM(o.due_amount) > 0
      ORDER BY SUM(o.due_amount) DESC
    `,

      // Sheet 7: Supply / Purchase History
      sql`
      SELECT
        pr.purchased_at::date                                   AS "Date",
        COALESCE(s.name, '—')                                   AS "Supplier",
        p.name                                                  AS "Product",
        pr.quantity::int                                        AS "Qty",
        p.unit                                                  AS "Unit",
        pr.unit_price::numeric                                  AS "Unit Price (৳)",
        pr.actual_total::numeric                                AS "Total (৳)",
        COALESCE((
          SELECT SUM(sp.amount)
          FROM supplier_payments sp
          WHERE sp.purchase_request_id = pr.id
        ), 0)::numeric                                          AS "Paid (৳)",
        (pr.actual_total - COALESCE((
          SELECT SUM(sp.amount)
          FROM supplier_payments sp
          WHERE sp.purchase_request_id = pr.id
        ), 0))::numeric                                         AS "Due (৳)",
        pr.note                                                 AS "Note"
      FROM purchase_requests pr
      JOIN products p ON p.id = pr.product_id
      LEFT JOIN suppliers s ON s.id = pr.supplier_id
      WHERE pr.status = 'purchased' ${purchaseProductFilter} ${purchaseDateFilter}
      ORDER BY pr.purchased_at DESC
    `,
    ]);

  const fmt = (d: unknown) =>
    d
      ? new Date(d as string).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";

  // Format summary as a label-value table for Excel
  const s = summary[0];
  const summaryRows = s
    ? [
        { Metric: "Product", Value: productLabel },
        {
          Metric: "Period",
          Value:
            from && to
              ? `${fmt(from)} – ${fmt(to)}`
              : from
                ? `From ${fmt(from)}`
                : to
                  ? `Up to ${fmt(to)}`
                  : "All Time",
        },
        { Metric: "Total Orders", Value: s.total_orders },
        { Metric: "Total Qty Sold", Value: s.total_qty },
        { Metric: "Gross Revenue (৳)", Value: Number(s.gross_revenue).toFixed(2) },
        { Metric: "Total Collected (৳)", Value: Number(s.total_collected).toFixed(2) },
        { Metric: "Outstanding Due (৳)", Value: Number(s.outstanding_due).toFixed(2) },
        { Metric: "Active Customers", Value: s.active_customers },
        { Metric: "Purchase Cost (৳)", Value: Number(s.total_purchase_cost).toFixed(2) },
        { Metric: "Gross Profit (৳)", Value: Number(s.gross_profit).toFixed(2) },
        { Metric: "Total Expenses (৳)", Value: Number(s.total_expenses).toFixed(2) },
        { Metric: "Net Position (৳)", Value: Number(s.net_position).toFixed(2) },
      ]
    : [];

  const formattedDailyTrend = dailyTrend.map((r: Record<string, unknown>) => ({
    ...r,
    Date: fmt(r["Date"]),
  }));

  const formattedDues = dues.map((r: Record<string, unknown>) => ({
    ...r,
    "Last Order": fmt(r["Last Order"]),
  }));

  const formattedSupplies = supplies.map((r: Record<string, unknown>) => ({
    ...r,
    Date: fmt(r["Date"]),
  }));

  return Response.json({
    summary: summaryRows,
    customers,
    dailyTrend: formattedDailyTrend,
    products,
    expenseBreakdown,
    dues: formattedDues,
    supplies: formattedSupplies,
  });
}
