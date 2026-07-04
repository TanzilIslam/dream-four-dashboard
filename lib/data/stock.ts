import { sql } from "@/lib/db";

export async function getProductStock() {
  return sql`
    SELECT
      p.id,
      p.name,
      p.unit,
      p.low_stock_threshold,
      COALESCE(purchased.qty, 0)                                          AS purchased_qty,
      COALESCE(reserved.qty, 0)                                           AS reserved_qty,
      COALESCE(delivered.qty, 0)                                          AS delivered_qty,
      COALESCE(returned.qty, 0)                                           AS returned_qty,
      COALESCE(purchased.qty, 0)
        - COALESCE(reserved.qty, 0)
        - COALESCE(delivered.qty, 0)
        + COALESCE(returned.qty, 0)
        + COALESCE(adjusted.qty, 0)                                       AS available_qty,
      COALESCE(adjusted.qty, 0)                                           AS adjusted_qty
    FROM products p
    LEFT JOIN (
      SELECT product_id, SUM(actual_qty) AS qty
      FROM purchase_requests
      WHERE status = 'purchased'
      GROUP BY product_id
    ) purchased ON purchased.product_id = p.id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) AS qty
      FROM orders
      WHERE status = 'pending'
      GROUP BY product_id
    ) reserved ON reserved.product_id = p.id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) AS qty
      FROM orders
      WHERE status IN ('delivered', 'paid')
      GROUP BY product_id
    ) delivered ON delivered.product_id = p.id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) AS qty
      FROM returns
      GROUP BY product_id
    ) returned ON returned.product_id = p.id
    LEFT JOIN (
      SELECT product_id, COALESCE(SUM(quantity), 0) AS qty
      FROM stock_adjustments
      GROUP BY product_id
    ) adjusted ON adjusted.product_id = p.id
    WHERE p.is_active = true
    ORDER BY p.name ASC
  `;
}

export async function getAssetStock() {
  const rows = await sql`
    SELECT
      pa.id          AS asset_id,
      pa.product_id,
      pa.name        AS asset_name,
      p.name         AS product_name,
      COALESCE(SUM(pra.quantity), 0)                                                          AS received,
      COALESCE((SELECT SUM(oa.quantity)  FROM order_assets          oa  WHERE oa.asset_id  = pa.id), 0) AS sent,
      COALESCE((SELECT SUM(oar.quantity) FROM order_asset_returns   oar WHERE oar.asset_id = pa.id), 0) AS returned_by_customers,
      COALESCE((SELECT SUM(sar.quantity) FROM supplier_asset_returns sar WHERE sar.asset_id = pa.id), 0) AS returned_to_suppliers
    FROM product_assets pa
    JOIN products p ON p.id = pa.product_id
    LEFT JOIN purchase_request_assets pra ON pra.asset_id = pa.id
    WHERE pa.is_active = true
    GROUP BY pa.id, pa.product_id, pa.name, p.name
    ORDER BY pa.product_id, pa.id
  `;

  return rows.map((r: Record<string, unknown>) => ({
    ...r,
    received: Number(r.received),
    sent: Number(r.sent),
    returned_by_customers: Number(r.returned_by_customers),
    returned_to_suppliers: Number(r.returned_to_suppliers),
    available:
      Number(r.received) -
      Number(r.sent) +
      Number(r.returned_by_customers) -
      Number(r.returned_to_suppliers),
    unreturned: Number(r.sent) - Number(r.returned_by_customers) - Number(r.returned_to_suppliers),
  }));
}
