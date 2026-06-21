"use client";

import { useEffect, useState } from "react";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  id: number;
  purchased_at: string;
  product_name: string;
  product_unit: string;
  actual_qty: number;
  actual_price: string;
  actual_total: string;
  payment_method: string | null;
  from_personal: boolean;
  supplier_name: string | null;
  partner_name: string | null;
};
type Totals = { grand_total: string; personal_total: string; total_qty: string };

export default function InvestmentLedgerPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.user?.role === "admin"));
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    fetch(`/api/reports/investment-ledger?${p}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows);
        setTotals(d.totals);
        setLoading(false);
      });
  }, [from, to]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Investment Ledger</h1>
        <p className="text-sm text-muted-foreground">All stock purchases.</p>
      </div>
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      {totals && (
        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            Total Qty: <strong>{Number(totals.total_qty).toLocaleString()}</strong>
          </span>
          <span>
            Total: <strong>৳{Number(totals.grand_total).toFixed(2)}</strong>
          </span>
          <span>
            Personal:{" "}
            <strong className="text-orange-600">৳{Number(totals.personal_total).toFixed(2)}</strong>
          </span>
        </div>
      )}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Partner</TableHead>}
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Personal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 9 : 8}
                  className="text-center py-10 text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 9 : 8}
                  className="text-center py-10 text-muted-foreground"
                >
                  No data
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  {isAdmin && <TableCell>{r.partner_name ?? "—"}</TableCell>}
                  <TableCell className="text-sm">
                    {r.purchased_at ? new Date(r.purchased_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    {r.product_name}
                    <span className="text-xs text-muted-foreground ml-1">({r.product_unit})</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.supplier_name ?? "—"}</TableCell>
                  <TableCell>{r.actual_qty}</TableCell>
                  <TableCell>৳{Number(r.actual_price).toFixed(2)}</TableCell>
                  <TableCell className="font-medium">
                    ৳{Number(r.actual_total).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.payment_method ?? "—"}</TableCell>
                  <TableCell>
                    {r.from_personal ? <Badge variant="secondary">Yes</Badge> : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
