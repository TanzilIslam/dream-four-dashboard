"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  customer_id: number;
  customer_name: string;
  customer_phone: string | null;
  area_name: string | null;
  partner_name: string | null;
  total_due: string;
  order_count: string;
  latest_promise: string | null;
  days_overdue: number;
};
type Totals = { debtor_count: string; grand_total: string };

export default function DueReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.user?.role === "admin"));
    fetch("/api/reports/due-report")
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows);
        setTotals(d.totals);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Due Report</h1>
          <p className="text-sm text-muted-foreground">All outstanding customer balances.</p>
        </div>
        {totals && (
          <div className="text-right text-sm">
            <p className="text-muted-foreground">{totals.debtor_count} customers</p>
            <p className="text-xl font-bold text-red-600">
              ৳{Number(totals.grand_total).toFixed(2)}
            </p>
          </div>
        )}
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Partner</TableHead>}
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Area</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Days Overdue</TableHead>
              <TableHead>Promise Date</TableHead>
              <TableHead className="text-right">Due Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 8 : 7}
                  className="text-center py-10 text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 8 : 7}
                  className="text-center py-10 text-muted-foreground"
                >
                  No outstanding dues
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.customer_id}>
                  {isAdmin && <TableCell>{r.partner_name ?? "—"}</TableCell>}
                  <TableCell className="font-medium">{r.customer_name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.customer_phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.area_name ?? "—"}</TableCell>
                  <TableCell className="text-right">{r.order_count}</TableCell>
                  <TableCell
                    className={`text-right font-medium ${r.days_overdue > 30 ? "text-red-600" : r.days_overdue > 7 ? "text-orange-500" : ""}`}
                  >
                    {r.days_overdue}d
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.latest_promise ? new Date(r.latest_promise).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right font-bold text-red-600">
                    ৳{Number(r.total_due).toFixed(2)}
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
