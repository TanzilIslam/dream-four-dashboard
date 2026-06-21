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
  partner_id: number;
  partner_name: string;
  personal_invested: string;
  total_invested: string;
  cash_collected: string;
  cash_remitted: string;
  expenses: string;
  outstanding_due: string;
  cash_in_hand: number;
};

export default function CashFlowPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    fetch(`/api/reports/cash-flow?${p}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d);
        setLoading(false);
      });
  }, [from, to]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Cash Flow</h1>
        <p className="text-sm text-muted-foreground">Per-partner financial position.</p>
      </div>
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead className="text-right">Invested</TableHead>
              <TableHead className="text-right">Personal</TableHead>
              <TableHead className="text-right">Collected</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Remitted</TableHead>
              <TableHead className="text-right">In Hand</TableHead>
              <TableHead className="text-right">Outstanding Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  No data
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.partner_id}>
                  <TableCell className="font-medium">{r.partner_name}</TableCell>
                  <TableCell className="text-right">
                    ৳{Number(r.total_invested).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-orange-600">
                    ৳{Number(r.personal_invested).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    ৳{Number(r.cash_collected).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    ৳{Number(r.expenses).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    ৳{Number(r.cash_remitted).toFixed(2)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${r.cash_in_hand < 0 ? "text-red-600" : ""}`}
                  >
                    ৳{r.cash_in_hand.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    ৳{Number(r.outstanding_due).toFixed(2)}
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
