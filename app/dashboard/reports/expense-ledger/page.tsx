"use client";

import { useEffect, useState } from "react";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
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
  date: string;
  amount: string;
  payment_method: string | null;
  description: string | null;
  category_name: string | null;
  area_name: string | null;
  partner_name: string | null;
};
type ByCategory = { category_name: string | null; total: string };

export default function ExpenseLedgerPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<{ grand_total: string } | null>(null);
  const [byCategory, setByCategory] = useState<ByCategory[]>([]);
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
    fetch(`/api/reports/expense-ledger?${p}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows);
        setTotals(d.totals);
        setByCategory(d.byCategory);
        setLoading(false);
      });
  }, [from, to]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Expense Ledger</h1>
        <p className="text-sm text-muted-foreground">All operational expenses.</p>
      </div>
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      <div className="flex flex-wrap gap-6">
        {totals && (
          <span className="text-sm">
            Total: <strong>৳{Number(totals.grand_total).toFixed(2)}</strong>
          </span>
        )}
        {byCategory.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {byCategory.map((c) => (
              <span key={c.category_name} className="text-xs bg-muted rounded-full px-2 py-0.5">
                {c.category_name ?? "Uncategorized"}: ৳{Number(c.total).toFixed(2)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Partner</TableHead>}
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 7 : 6}
                  className="text-center py-10 text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 7 : 6}
                  className="text-center py-10 text-muted-foreground"
                >
                  No data
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  {isAdmin && <TableCell>{r.partner_name ?? "—"}</TableCell>}
                  <TableCell className="text-sm">{new Date(r.date).toLocaleDateString()}</TableCell>
                  <TableCell>{r.category_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.area_name ?? "—"}</TableCell>
                  <TableCell className="font-medium">৳{Number(r.amount).toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.payment_method ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[180px] truncate">
                    {r.description ?? "—"}
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
