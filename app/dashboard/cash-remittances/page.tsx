"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, CheckCircle2 } from "lucide-react";

import {
  createCashRemittanceSchema,
  type CreateCashRemittanceInput,
} from "@/lib/schemas/cash-remittance";
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

type Remittance = {
  id: number;
  amount: string;
  payment_method: string | null;
  note: string | null;
  status: "pending" | "acknowledged";
  submitted_at: string;
  admin_note: string | null;
  partner_name?: string | null;
  acknowledged_by_name?: string | null;
};

export default function CashRemittancesPage() {
  const [remittances, setRemittances] = useState<Remittance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [acknowledgeTarget, setAcknowledgeTarget] = useState<Remittance | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [adminNote, setAdminNote] = useState("");

  const form = useForm<CreateCashRemittanceInput>({
    resolver: zodResolver(createCashRemittanceSchema),
    defaultValues: { amount: 0, payment_method: "", note: "" },
  });

  useEffect(() => {
    fetch(`/api/cash-remittances?status=${statusFilter}`)
      .then((res) => res.json())
      .then((data) => {
        setRemittances(data);
        setLoading(false);
      });
  }, [statusFilter]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setIsAdmin(data.user?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  async function refreshRemittances() {
    const res = await fetch(`/api/cash-remittances?status=${statusFilter}`);
    setRemittances(await res.json());
  }

  async function onSubmit(data: CreateCashRemittanceInput) {
    const res = await fetch("/api/cash-remittances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Remittance submitted");
      setCreateOpen(false);
      refreshRemittances();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to submit");
    }
  }

  async function handleAcknowledge() {
    if (!acknowledgeTarget) return;
    setAcknowledging(true);
    const res = await fetch(`/api/cash-remittances/${acknowledgeTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_note: adminNote }),
    });
    if (res.ok) {
      toast.success("Remittance acknowledged");
      setAcknowledgeTarget(null);
      setAdminNote("");
      refreshRemittances();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to acknowledge");
    }
    setAcknowledging(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cash Remittances</h1>
          <p className="text-sm text-muted-foreground">Submit collected cash to the business.</p>
        </div>
        {!isAdmin && (
          <Button
            size="sm"
            onClick={() => {
              form.reset({ amount: 0, payment_method: "", note: "" });
              setCreateOpen(true);
            }}
          >
            <PlusIcon className="size-4" />
            Submit Cash
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Filter:</Label>
        <Select value={statusFilter} onValueChange={(v) => v != null && setStatusFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Partner</TableHead>}
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              {isAdmin && <TableHead className="w-[60px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 7 : 5}
                  className="text-center text-muted-foreground py-10"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : remittances.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 7 : 5}
                  className="text-center text-muted-foreground py-10"
                >
                  No remittances
                </TableCell>
              </TableRow>
            ) : (
              remittances.map((r) => (
                <TableRow key={r.id}>
                  {isAdmin && <TableCell>{r.partner_name ?? "—"}</TableCell>}
                  <TableCell className="font-medium">৳{Number(r.amount).toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.payment_method ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[160px] truncate">
                    {r.note ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "acknowledged" ? "default" : "secondary"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(r.submitted_at).toLocaleDateString()}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {r.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setAdminNote("");
                            setAcknowledgeTarget(r);
                          }}
                          className="size-7 text-green-600 hover:bg-green-50 hover:text-green-700"
                          title="Acknowledge"
                        >
                          <CheckCircle2 className="size-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Submit sheet (partner) */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Submit Cash</SheetTitle>
          </SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5 px-4 pb-8">
            <Field label="Amount (৳)" error={form.formState.errors.amount?.message}>
              <Input
                type="number"
                step="0.01"
                {...form.register("amount", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Payment Method">
              <Input placeholder="Cash, bKash…" {...form.register("payment_method")} />
            </Field>
            <Field label="Note">
              <Textarea placeholder="Any notes for admin…" {...form.register("note")} />
            </Field>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-1/2">
                {form.formState.isSubmitting ? "Submitting…" : "Submit"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="w-1/2"
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Acknowledge sheet (admin) */}
      <Sheet
        open={acknowledgeTarget !== null}
        onOpenChange={(open) => !open && setAcknowledgeTarget(null)}
      >
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Acknowledge Remittance</SheetTitle>
          </SheetHeader>
          {acknowledgeTarget && (
            <div className="px-4 pt-3 text-sm text-muted-foreground">
              {acknowledgeTarget.partner_name} submitted ৳
              {Number(acknowledgeTarget.amount).toFixed(2)}
            </div>
          )}
          <div className="mt-4 space-y-5 px-4 pb-8">
            <Field label="Admin Note (optional)">
              <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button onClick={handleAcknowledge} disabled={acknowledging} className="w-1/2">
                {acknowledging ? "Saving…" : "Acknowledge"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setAcknowledgeTarget(null)}
                className="w-1/2"
              >
                Cancel
              </Button>
            </div>
          </div>
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
