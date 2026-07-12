"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PlusIcon, Undo2, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Loan = {
  id: number;
  person_name: string;
  amount: string;
  reason: string | null;
  note: string | null;
  loaned_at: string;
  status: "outstanding" | "returned";
  returned_at: string | null;
  created_by_name: string | null;
};

function fmt(n: string | number) {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "outstanding" | "returned">(
    "outstanding"
  );

  // Create sheet
  const [createOpen, setCreateOpen] = useState(false);
  const [personName, setPersonName] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [loanedAt, setLoanedAt] = useState(new Date().toISOString().slice(0, 10));
  const [creating, setCreating] = useState(false);

  // Return sheet
  const [returnTarget, setReturnTarget] = useState<Loan | null>(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [returning, setReturning] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Loan | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    fetch("/api/loans")
      .then((r) => r.json())
      .then((data: Loan[]) => {
        setLoans(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = loans.filter((l) => (statusFilter === "all" ? true : l.status === statusFilter));

  const totalOutstanding = loans
    .filter((l) => l.status === "outstanding")
    .reduce((s, l) => s + Number(l.amount), 0);

  async function handleCreate() {
    if (!personName.trim() || !amount) return;
    setCreating(true);
    const res = await fetch("/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        person_name: personName.trim(),
        amount: Number(amount),
        reason: reason || undefined,
        note: note || undefined,
        loaned_at: loanedAt,
      }),
    });
    setCreating(false);
    if (res.ok) {
      toast.success("Loan recorded");
      setCreateOpen(false);
      setPersonName("");
      setAmount("");
      setReason("");
      setNote("");
      setLoanedAt(new Date().toISOString().slice(0, 10));
      load();
    } else {
      toast.error("Failed to save loan");
    }
  }

  async function handleReturn() {
    if (!returnTarget) return;
    setReturning(true);
    const res = await fetch(`/api/loans/${returnTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "return", returned_at: returnDate }),
    });
    setReturning(false);
    if (res.ok) {
      toast.success("Marked as returned");
      setReturnTarget(null);
      load();
    } else {
      toast.error("Failed to update");
    }
  }

  async function handleReopen(loan: Loan) {
    const res = await fetch(`/api/loans/${loan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen" }),
    });
    if (res.ok) {
      toast.success("Reopened");
      load();
    } else toast.error("Failed");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/loans/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      toast.success("Deleted");
      setDeleteTarget(null);
      load();
    } else toast.error("Failed to delete");
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Loans</h1>
          <p className="text-sm text-muted-foreground">
            Outstanding:{" "}
            <span className="font-medium text-foreground">৳{fmt(totalOutstanding)}</span>
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          Give Loan
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {(["outstanding", "returned", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors capitalize ${
              statusFilter === s
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
            <span className="ml-1.5 text-xs opacity-70">
              {s === "all" ? loans.length : loans.filter((l) => l.status === s).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Returned On</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  <Loader2 className="size-4 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  No loans found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.person_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{l.reason || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {new Date(l.loaned_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    ৳{fmt(l.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={l.status === "outstanding" ? "secondary" : "outline"}>
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {l.returned_at
                      ? new Date(l.returned_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      {l.status === "outstanding" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-green-600 hover:bg-green-50 hover:text-green-700"
                          title="Mark returned"
                          onClick={() => {
                            setReturnTarget(l);
                            setReturnDate(new Date().toISOString().slice(0, 10));
                          }}
                        >
                          <Undo2 className="size-3.5" />
                        </Button>
                      )}
                      {l.status === "returned" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title="Reopen"
                          onClick={() => handleReopen(l)}
                        >
                          <Undo2 className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:bg-destructive/10"
                        title="Delete"
                        onClick={() => setDeleteTarget(l)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="!w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Give Loan</SheetTitle>
          </SheetHeader>
          <div className="mt-6 px-4 pb-8 space-y-4">
            <div className="space-y-1.5">
              <Label>
                Person Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Enter name"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Amount (৳) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={loanedAt} onChange={(e) => setLoanedAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input
                placeholder="e.g. Personal, Medical…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input
                placeholder="Any extra note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button
              className="w-full mt-2"
              disabled={creating || !personName.trim() || !amount}
              onClick={handleCreate}
            >
              {creating ? <Loader2 className="size-4 animate-spin" /> : "Record Loan"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Return Sheet */}
      <Sheet open={returnTarget !== null} onOpenChange={(open) => !open && setReturnTarget(null)}>
        <SheetContent className="!w-full sm:max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Mark as Returned</SheetTitle>
          </SheetHeader>
          {returnTarget && (
            <div className="mt-6 px-4 pb-8 space-y-4">
              <div className="rounded-lg border border-border p-4 text-sm space-y-1">
                <p className="font-semibold text-base">{returnTarget.person_name}</p>
                <p className="text-muted-foreground">{returnTarget.reason || "No reason"}</p>
                <p className="text-lg font-bold tabular-nums">৳{fmt(returnTarget.amount)}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Return Date</Label>
                <Input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" disabled={returning} onClick={handleReturn}>
                  {returning ? <Loader2 className="size-4 animate-spin" /> : "Confirm Return"}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setReturnTarget(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Loan"
        description={`Delete loan of ৳${fmt(deleteTarget?.amount ?? 0)} to ${deleteTarget?.person_name}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
