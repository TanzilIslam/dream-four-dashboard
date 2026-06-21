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

type PartnerRow = {
  partner_id: number;
  partner_name: string;
  revenue: number;
  stock_cost: number;
  expenses: number;
  net: number;
};
type AreaRow = {
  area_id: number;
  area_name: string;
  revenue: string;
  customer_count: string;
  order_count: string;
};
type Totals = { revenue: number; stock_cost: number; expenses: number; net: number };

function Cell({ v, color }: { v: number; color?: string }) {
  return <TableCell className={`text-right ${color ?? ""}`}>৳{v.toFixed(2)}</TableCell>;
}

export default function PnlPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
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
    fetch(`/api/reports/pnl?${p}`)
      .then((r) => r.json())
      .then((d) => {
        setPartners(d.partners);
        setAreas(d.areas);
        setTotals(d.totals);
        setLoading(false);
      });
  }, [from, to]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">P&amp;L Report</h1>
        <p className="text-sm text-muted-foreground">Revenue, cost, and net profit.</p>
      </div>
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      {/* Partner P&L */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">By Partner</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Stock Cost</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : (
                partners.map((p) => (
                  <TableRow key={p.partner_id}>
                    <TableCell className="font-medium">{p.partner_name}</TableCell>
                    <Cell v={p.revenue} color="text-green-600" />
                    <Cell v={p.stock_cost} color="text-muted-foreground" />
                    <Cell v={p.expenses} color="text-muted-foreground" />
                    <Cell v={p.net} color={p.net >= 0 ? "font-bold" : "font-bold text-red-600"} />
                  </TableRow>
                ))
              )}
              {totals && (
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Total</TableCell>
                  <Cell v={totals.revenue} color="text-green-600" />
                  <Cell v={totals.stock_cost} />
                  <Cell v={totals.expenses} />
                  <Cell v={totals.net} color={totals.net >= 0 ? "" : "text-red-600"} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Area breakdown (admin only) */}
      {isAdmin && areas.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">By Area</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((a) => (
                  <TableRow key={a.area_id}>
                    <TableCell className="font-medium">{a.area_name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {a.customer_count}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {a.order_count}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ৳{Number(a.revenue).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
