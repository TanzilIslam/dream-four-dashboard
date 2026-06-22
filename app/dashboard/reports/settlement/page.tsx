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
  payout: number;
};
type Summary = {
  total_net: number;
  tech_share: number;
  partner_pool: number;
  partner_count: number;
  per_partner: number;
};

export default function SettlementPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + "-01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [settlement, setSettlement] = useState<PartnerRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    fetch(`/api/reports/settlement?${p}`).then((r) => {
      if (r.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      r.json().then((d) => {
        setSettlement(d.settlement);
        setSummary(d.summary);
        setLoading(false);
      });
    });
  }, [from, to]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Profit Settlement</h1>
        <p className="text-sm text-muted-foreground">
          Period P&amp;L → tech share → partner payout.
        </p>
      </div>
      {forbidden ? (
        <p className="text-sm text-muted-foreground py-10 text-center">
          This report is only available to admins.
        </p>
      ) : (
        <>
          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

          {/* Summary */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Net Profit",
                  value: summary.total_net,
                  color: summary.total_net >= 0 ? "" : "text-red-600",
                },
                { label: "Tech Share (7.5%)", value: summary.tech_share, color: "text-orange-600" },
                { label: "Partner Pool", value: summary.partner_pool, color: "" },
                {
                  label: `Per Partner (÷${summary.partner_count})`,
                  value: summary.per_partner,
                  color: "text-green-600 font-bold",
                },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                  <p className={`text-xl font-semibold ${c.color}`}>৳{c.value.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Per-partner breakdown */}
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Stock Cost</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : settlement.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      No data
                    </TableCell>
                  </TableRow>
                ) : (
                  settlement.map((p) => (
                    <TableRow key={p.partner_id}>
                      <TableCell className="font-medium">{p.partner_name}</TableCell>
                      <TableCell className="text-right text-green-600">
                        ৳{p.revenue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ৳{p.stock_cost.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ৳{p.expenses.toFixed(2)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${p.net < 0 ? "text-red-600" : ""}`}
                      >
                        ৳{p.net.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-700">
                        ৳{p.payout.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
