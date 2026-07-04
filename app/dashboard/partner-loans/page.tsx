"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { extractError } from "@/lib/utils";

import {
  createLoanRepaymentSchema,
  type CreateLoanRepaymentInput,
} from "@/lib/schemas/partner-loan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

type Loan = {
  id: number;
  partner_id: number;
  amount: string;
  repaid_amount: string;
  reason: string | null;
  status: "outstanding" | "settled";
  created_at: string;
  partner_name?: string | null;
};

export default function PartnerLoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [statusFilter, setStatusFilter] = useState("outstanding");
  const [repayTarget, setRepayTarget] = useState<Loan | null>(null);
  const [repaying, setRepaying] = useState(false);

  const form = useForm<CreateLoanRepaymentInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createLoanRepaymentSchema) as any,
    defaultValues: { amount: 0, method: "", note: "" },
  });

  useEffect(() => {
    fetch(`/api/partner-loans?status=${statusFilter}`)
      .then((res) => res.json())
      .then((data) => {
        setLoans(data);
        setLoading(false);
      });
  }, [statusFilter]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setIsAdmin(data.user?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  async function refreshLoans() {
    const res = await fetch(`/api/partner-loans?status=${statusFilter}`);
    setLoans(await res.json());
  }

  async function onRepay(data: CreateLoanRepaymentInput) {
    if (!repayTarget) return;
    setRepaying(true);
    const res = await fetch(`/api/partner-loans/${repayTarget.id}/repayments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Repayment recorded");
      setRepayTarget(null);
      refreshLoans();
    } else {
      const json = await res.json();
      toast.error(extractError(json.error, "Failed to record repayment"));
    }
    setRepaying(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Partner Loans</h1>
          <p className="text-sm text-muted-foreground">Track loans issued to partners.</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Filter:</Label>
        <Select value={statusFilter} onValueChange={(v) => v != null && setStatusFilter(v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="outstanding">Outstanding</SelectItem>
            <SelectItem value="settled">Settled</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Partner</TableHead>}
              <TableHead>Loan Amount</TableHead>
              <TableHead>Repaid</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              {isAdmin && <TableHead className="w-[100px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 8 : 6}
                  className="text-center text-muted-foreground py-10"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : loans.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 8 : 6}
                  className="text-center text-muted-foreground py-10"
                >
                  No loans
                </TableCell>
              </TableRow>
            ) : (
              loans.map((loan) => {
                const total = Number(loan.amount);
                const repaid = Number(loan.repaid_amount);
                const remaining = total - repaid;
                return (
                  <TableRow key={loan.id}>
                    {isAdmin && <TableCell>{loan.partner_name ?? "—"}</TableCell>}
                    <TableCell className="font-medium">৳{total.toFixed(2)}</TableCell>
                    <TableCell className="text-green-600">৳{repaid.toFixed(2)}</TableCell>
                    <TableCell
                      className={
                        remaining > 0 ? "text-red-600 font-medium" : "text-muted-foreground"
                      }
                    >
                      ৳{remaining.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[160px] truncate">
                      {loan.reason ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={loan.status === "settled" ? "default" : "secondary"}>
                        {loan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(loan.created_at).toLocaleDateString()}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {loan.status === "outstanding" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              form.reset({ amount: 0, method: "", note: "" });
                              setRepayTarget(loan);
                            }}
                          >
                            Repay
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Repayment sheet (admin only) */}
      <Sheet open={repayTarget !== null} onOpenChange={(open) => !open && setRepayTarget(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Record Repayment</SheetTitle>
          </SheetHeader>
          {repayTarget && (
            <div className="px-4 pt-3 text-sm text-muted-foreground space-y-0.5">
              <p>
                {repayTarget.partner_name} — Loan ৳{Number(repayTarget.amount).toFixed(2)}
              </p>
              <p>
                Remaining: ৳
                {(Number(repayTarget.amount) - Number(repayTarget.repaid_amount)).toFixed(2)}
              </p>
            </div>
          )}
          <form onSubmit={form.handleSubmit(onRepay)} className="mt-4 space-y-5 px-4 pb-8">
            <Field label="Amount (৳)" error={form.formState.errors.amount?.message}>
              <Input
                type="number"
                step="0.01"
                max={
                  repayTarget
                    ? Number(repayTarget.amount) - Number(repayTarget.repaid_amount)
                    : undefined
                }
                {...form.register("amount", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Method">
              <Input placeholder="Cash, bKash…" {...form.register("method")} />
            </Field>
            <Field label="Note">
              <Textarea {...form.register("note")} />
            </Field>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={repaying} className="w-1/2">
                {repaying ? "Saving…" : "Record"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRepayTarget(null)}
                className="w-1/2"
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
