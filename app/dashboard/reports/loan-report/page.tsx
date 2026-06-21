"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  partner_name: string | null;
  amount: string;
  repaid_amount: string;
  reason: string | null;
  status: string;
  created_at: string;
};
type Totals = { total_loaned: string; total_repaid: string };

export default function LoanReportPage() {
  const [statusFilter, setStatusFilter] = useState("all");
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
    fetch(`/api/reports/loan-report?status=${statusFilter}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows);
        setTotals(d.totals);
        setLoading(false);
      });
  }, [statusFilter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Loan Report</h1>
        <p className="text-sm text-muted-foreground">Partner loans and repayments.</p>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Status:</Label>
        <Select value={statusFilter} onValueChange={(v) => v != null && setStatusFilter(v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="outstanding">Outstanding</SelectItem>
            <SelectItem value="settled">Settled</SelectItem>
          </SelectContent>
        </Select>
        {totals && (
          <span className="ml-4 text-sm">
            Loaned: <strong>৳{Number(totals.total_loaned).toFixed(2)}</strong>
            {" · "}
            Repaid:{" "}
            <strong className="text-green-600">৳{Number(totals.total_repaid).toFixed(2)}</strong>
            {" · "}
            Outstanding:{" "}
            <strong className="text-red-600">
              ৳{(Number(totals.total_loaned) - Number(totals.total_repaid)).toFixed(2)}
            </strong>
          </span>
        )}
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Partner</TableHead>}
              <TableHead>Date</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Repaid</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Status</TableHead>
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
                  No loans
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  {isAdmin && <TableCell>{r.partner_name ?? "—"}</TableCell>}
                  <TableCell className="text-sm">
                    {new Date(r.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.reason ?? "—"}</TableCell>
                  <TableCell className="text-right">৳{Number(r.amount).toFixed(2)}</TableCell>
                  <TableCell className="text-right text-green-600">
                    ৳{Number(r.repaid_amount).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-red-600 font-medium">
                    ৳{(Number(r.amount) - Number(r.repaid_amount)).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "settled" ? "default" : "secondary"}>
                      {r.status}
                    </Badge>
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
