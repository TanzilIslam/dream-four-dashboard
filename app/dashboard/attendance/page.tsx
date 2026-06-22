"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";

import { ACTIVITIES, type Activity } from "@/lib/schemas/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AttendanceLog = {
  id: number;
  partner_id: number;
  partner_name: string;
  activity: Activity;
  punched_at: string;
  note: string | null;
  location: string | null;
};

type SummaryRow = {
  partner_id: number;
  partner_name: string;
  punch_in_at: string | null;
  punch_out_at: string | null;
  punch_count: string;
};

const ACTIVITY_LABELS: Record<Activity, string> = {
  punch_in: "Punch In",
  farm_out: "Left for Farm",
  farm_in: "Back from Farm",
  delivery_out: "Left for Delivery",
  delivery_in: "Back from Delivery",
  punch_out: "Punch Out",
};

const ACTIVITY_COLORS: Record<Activity, string> = {
  punch_in: "bg-green-100 text-green-800",
  farm_out: "bg-orange-100 text-orange-800",
  farm_in: "bg-orange-50 text-orange-700",
  delivery_out: "bg-blue-100 text-blue-800",
  delivery_in: "bg-blue-50 text-blue-700",
  punch_out: "bg-gray-100 text-gray-700",
};

function now() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AttendancePage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [activity, setActivity] = useState<Activity>("punch_in");
  const [punchTime, setPunchTime] = useState(now());

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setIsAdmin(data.user?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    const base = isAdmin ? `/api/attendance/summary?date=${date}` : `/api/attendance?date=${date}`;
    fetch(base)
      .then((res) => res.json())
      .then((data) => {
        if (isAdmin) setSummary(data);
        else setLogs(data);
        setLoading(false);
      });
  }, [date, isAdmin]);

  async function handlePunch() {
    setPunching(true);
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activity, punched_at: new Date(punchTime).toISOString() }),
    });
    if (res.ok) {
      toast.success(`${ACTIVITY_LABELS[activity]} recorded`);
      // Refresh logs
      const refreshed = await fetch(`/api/attendance?date=${date}`);
      setLogs(await refreshed.json());
      setPunchTime(now());
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to record punch");
    }
    setPunching(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Attendance</h1>
          <p className="text-sm text-muted-foreground">Track daily punches and working hours.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Date</Label>
          <Input
            type="date"
            className="w-36"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {/* Partner punch panel */}
      {!isAdmin && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h2 className="text-sm font-medium">Record Activity</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Activity</Label>
              <Select
                value={activity}
                onValueChange={(v) => v != null && setActivity(v as Activity)}
              >
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITIES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {ACTIVITY_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Time</Label>
              <Input
                type="datetime-local"
                className="w-52"
                value={punchTime}
                onChange={(e) => setPunchTime(e.target.value)}
              />
            </div>
            <Button onClick={handlePunch} disabled={punching} className="gap-1.5">
              <Clock className="size-4" />
              {punching ? "Recording…" : "Record"}
            </Button>
          </div>
        </div>
      )}

      {/* Partner timeline */}
      {!isAdmin && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                    No punches for this date
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ACTIVITY_COLORS[log.activity]}`}
                      >
                        {ACTIVITY_LABELS[log.activity]}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(log.punched_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {log.note ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Admin summary */}
      {isAdmin && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Punch In</TableHead>
                <TableHead>Punch Out</TableHead>
                <TableHead>Activities</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : summary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    No partners found
                  </TableCell>
                </TableRow>
              ) : (
                summary.map((row) => {
                  const hasIn = !!row.punch_in_at;
                  const hasOut = !!row.punch_out_at;
                  const count = Number(row.punch_count);
                  return (
                    <TableRow key={row.partner_id}>
                      <TableCell className="font-medium">{row.partner_name}</TableCell>
                      <TableCell className="text-sm">
                        {row.punch_in_at ? (
                          new Date(row.punch_in_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.punch_out_at ? (
                          new Date(row.punch_out_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {count > 0 ? count : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={hasIn && hasOut ? "default" : hasIn ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {hasIn && hasOut ? "Done" : hasIn ? "Working" : "Absent"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
