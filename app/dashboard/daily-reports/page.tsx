"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Send, CheckCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Report = {
  id: number;
  partner_id: number;
  partner_name?: string;
  report_date: string;
  status: "draft" | "submitted" | "reviewed";
  eggs_delivered: number;
  cash_collected: string;
  due_added: string;
  eggs_returned: number;
  total_expenses: string;
  member_note: string | null;
  admin_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  reviewed: "default",
  submitted: "secondary",
  draft: "outline",
};

export default function DailyReportsPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<Report | null>(null);
  const [adminReports, setAdminReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitNote, setSubmitNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<Report | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setIsAdmin(data.user?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, isAdmin]);

  async function loadReports() {
    setLoading(true);
    const res = await fetch(`/api/daily-reports?date=${date}`);
    const data = await res.json();
    if (isAdmin) {
      setAdminReports(Array.isArray(data) ? data : []);
    } else {
      setReport(data && !Array.isArray(data) ? data : null);
    }
    setLoading(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    await fetch(`/api/daily-reports?date=${date}`);
    await loadReports();
    setGenerating(false);
    toast.success("Report refreshed");
  }

  async function handleSubmit() {
    if (!report) return;
    setSubmitting(true);
    const res = await fetch(`/api/daily-reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", note: submitNote }),
    });
    if (res.ok) {
      toast.success("Report submitted");
      setSubmitOpen(false);
      setSubmitNote("");
      await loadReports();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to submit");
    }
    setSubmitting(false);
  }

  async function handleReview() {
    if (!reviewTarget) return;
    setReviewing(true);
    const res = await fetch(`/api/daily-reports/${reviewTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "review", admin_note: adminNote }),
    });
    if (res.ok) {
      toast.success("Report reviewed");
      setReviewTarget(null);
      setAdminNote("");
      await loadReports();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed");
    }
    setReviewing(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Daily Reports</h1>
          <p className="text-sm text-muted-foreground">End-of-day summary per partner.</p>
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

      {/* Partner view */}
      {!isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={generating}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${generating ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {report && report.status === "draft" && (
              <Button
                size="sm"
                onClick={() => {
                  setSubmitNote(report.member_note ?? "");
                  setSubmitOpen(true);
                }}
                className="gap-1.5"
              >
                <Send className="size-3.5" />
                Submit Report
              </Button>
            )}
            {report && <Badge variant={STATUS_VARIANT[report.status]}>{report.status}</Badge>}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !report ? (
            <p className="text-sm text-muted-foreground">No report for this date.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Eggs Delivered" value={String(report.eggs_delivered)} />
              <StatCard
                label="Cash Collected"
                value={`৳${Number(report.cash_collected).toFixed(2)}`}
              />
              <StatCard label="Due Added" value={`৳${Number(report.due_added).toFixed(2)}`} />
              <StatCard label="Eggs Returned" value={String(report.eggs_returned)} />
              <StatCard label="Expenses" value={`৳${Number(report.total_expenses).toFixed(2)}`} />
            </div>
          )}

          {report?.member_note && (
            <div className="rounded-md border border-border p-3 text-sm">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Your Note</p>
              <p>{report.member_note}</p>
            </div>
          )}
          {report?.admin_note && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Admin Note</p>
              <p>{report.admin_note}</p>
            </div>
          )}
        </div>
      )}

      {/* Admin view */}
      {isAdmin && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Eggs Delivered</TableHead>
                <TableHead>Cash Collected</TableHead>
                <TableHead>Due Added</TableHead>
                <TableHead>Expenses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : adminReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No reports for this date
                  </TableCell>
                </TableRow>
              ) : (
                adminReports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.partner_name ?? "—"}</TableCell>
                    <TableCell>{r.eggs_delivered}</TableCell>
                    <TableCell>৳{Number(r.cash_collected).toFixed(2)}</TableCell>
                    <TableCell>৳{Number(r.due_added).toFixed(2)}</TableCell>
                    <TableCell>৳{Number(r.total_expenses).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.status === "submitted" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => {
                            setAdminNote("");
                            setReviewTarget(r);
                          }}
                        >
                          <CheckCheck className="size-3.5" />
                          Review
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Submit sheet (partner) */}
      <Sheet open={submitOpen} onOpenChange={setSubmitOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Submit Daily Report</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5 px-4 pb-8">
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea
                placeholder="Any notes for admin…"
                value={submitNote}
                onChange={(e) => setSubmitNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting} className="w-1/2">
                {submitting ? "Submitting…" : "Submit"}
              </Button>
              <Button variant="outline" onClick={() => setSubmitOpen(false)} className="w-1/2">
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Review sheet (admin) */}
      <Sheet open={reviewTarget !== null} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Review Report</SheetTitle>
          </SheetHeader>
          {reviewTarget && (
            <div className="px-4 pt-3 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">{reviewTarget.partner_name}</p>
              {reviewTarget.member_note && (
                <p className="italic">&ldquo;{reviewTarget.member_note}&rdquo;</p>
              )}
            </div>
          )}
          <div className="mt-4 space-y-5 px-4 pb-8">
            <div className="space-y-1.5">
              <Label>Admin Note (optional)</Label>
              <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleReview} disabled={reviewing} className="w-1/2">
                {reviewing ? "Saving…" : "Mark Reviewed"}
              </Button>
              <Button variant="outline" onClick={() => setReviewTarget(null)} className="w-1/2">
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
