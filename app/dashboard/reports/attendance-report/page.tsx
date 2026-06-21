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
  partner_name: string;
  work_date: string;
  punch_in_at: string | null;
  punch_out_at: string | null;
  total_punches: string;
  total_minutes: number | null;
  farm_minutes: number | null;
};

function fmt(min: number | null) {
  if (min === null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AttendanceReportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    fetch(`/api/reports/attendance-report?${p}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d);
        setLoading(false);
      });
  }, [from, to]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Attendance Report</h1>
        <p className="text-sm text-muted-foreground">Daily working hours per partner.</p>
      </div>
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Punch In</TableHead>
              <TableHead>Punch Out</TableHead>
              <TableHead className="text-right">Total Hours</TableHead>
              <TableHead className="text-right">Farm Time</TableHead>
              <TableHead className="text-right">Punches</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No attendance data
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.partner_name}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(r.work_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm">{fmtTime(r.punch_in_at)}</TableCell>
                  <TableCell className="text-sm">{fmtTime(r.punch_out_at)}</TableCell>
                  <TableCell className="text-right">{fmt(r.total_minutes)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {fmt(r.farm_minutes)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.total_punches}
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
