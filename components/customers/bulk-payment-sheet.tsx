"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatTaka, extractError } from "@/lib/utils";

type DueOrder = {
  id: number;
  ordered_at: string;
  delivered_at: string | null;
  status: string;
  due_amount: string;
  product_name: string;
};

type BulkPaymentSheetProps = {
  customer: { id: number; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

function todayISO(): string {
  const now = new Date();
  const tz = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tz).toISOString().slice(0, 10);
}

export function BulkPaymentSheet({ customer, onOpenChange, onSuccess }: BulkPaymentSheetProps) {
  const open = customer !== null;

  const [dueOrders, setDueOrders] = useState<DueOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [paidAt, setPaidAt] = useState(todayISO());
  const [amountInput, setAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load the customer's delivered orders that still have a due, oldest first
  // (same ordering the backend uses so the preview matches exactly).
  useEffect(() => {
    if (!customer) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setAmountInput("");
    setPaidAt(todayISO());
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(`/api/customers/${customer.id}/payments`)
      .then((r) => r.json())
      .then((data) => {
        const orders: DueOrder[] = (data.orders ?? [])
          .filter((o: DueOrder) => Number(o.due_amount) > 0 && o.status === "delivered")
          .sort(
            (a: DueOrder, b: DueOrder) =>
              new Date(a.ordered_at).getTime() - new Date(b.ordered_at).getTime() || a.id - b.id
          );
        setDueOrders(orders);
      })
      .catch(() => toast.error("Failed to load due orders"))
      .finally(() => setLoading(false));
  }, [customer]);

  const totalDue = useMemo(
    () => dueOrders.reduce((sum, o) => sum + Number(o.due_amount), 0),
    [dueOrders]
  );

  const amount = Number(amountInput);
  const amountValid = amountInput !== "" && Number.isFinite(amount) && amount > 0;
  const exceedsDue = amountValid && amount > totalDue + 0.001;

  // Live preview: split the amount across due orders, oldest first.
  const preview = useMemo(() => {
    if (!amountValid) return [] as { id: number; alloc: number }[];
    let remaining = amount;
    return dueOrders.map((o) => {
      const due = Number(o.due_amount);
      const alloc = Math.min(due, Math.max(0, remaining));
      remaining = Math.round((remaining - alloc) * 100) / 100;
      return { id: o.id, alloc };
    });
  }, [amountValid, amount, dueOrders]);

  const allocFor = (orderId: number) => preview.find((p) => p.id === orderId)?.alloc ?? 0;

  const canSubmit =
    !!customer && amountValid && !exceedsDue && dueOrders.length > 0 && !!paidAt && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer || !canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/bulk-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, paid_at: paidAt }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(extractError(data?.error, "Payment failed"));
        return;
      }

      toast.success(
        `${data.orders_paid} order${data.orders_paid > 1 ? "s" : ""} settled — ${formatTaka(
          data.total_allocated
        )} applied`
      );
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error("Payment failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <SheetContent className="!w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Collect Payment — {customer?.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 px-4 pb-8">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Date */}
              <div className="space-y-1.5">
                <Label htmlFor="bulk-paid-at">Payment Date</Label>
                <Input
                  id="bulk-paid-at"
                  type="date"
                  value={paidAt}
                  max={todayISO()}
                  onChange={(e) => setPaidAt(e.target.value)}
                  disabled={submitting}
                />
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <Label htmlFor="bulk-amount">Amount (৳)</Label>
                <Input
                  id="bulk-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="Enter amount received"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  disabled={submitting || dueOrders.length === 0}
                  autoFocus
                />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Total due:{" "}
                    <span className="font-medium text-foreground">{formatTaka(totalDue)}</span>
                  </span>
                  {totalDue > 0 && (
                    <button
                      type="button"
                      className="text-green-600 hover:underline"
                      onClick={() => setAmountInput(String(totalDue))}
                      disabled={submitting}
                    >
                      Pay full due
                    </button>
                  )}
                </div>
                {exceedsDue && (
                  <p className="text-xs text-destructive">
                    Amount is more than the total due ({formatTaka(totalDue)}).
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {submitting ? "Applying…" : "Apply Payment"}
              </Button>

              {/* Due orders list + live allocation preview */}
              <div className="pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Due orders {dueOrders.length > 0 && `(${dueOrders.length})`}
                </p>
                {dueOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6 rounded-md border border-border">
                    No delivered orders with an outstanding due.
                  </p>
                ) : (
                  <div className="rounded-md border border-border overflow-x-auto text-sm">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground">
                          <th className="text-left px-3 py-2 font-medium">Date</th>
                          <th className="text-left px-3 py-2 font-medium">Product</th>
                          <th className="text-right px-3 py-2 font-medium">Due</th>
                          {amountValid && (
                            <th className="text-right px-3 py-2 font-medium">Will apply</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {dueOrders.map((o) => {
                          const alloc = allocFor(o.id);
                          return (
                            <tr key={o.id} className="hover:bg-muted/30">
                              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                {formatDate(o.ordered_at)}
                              </td>
                              <td className="px-3 py-2">{o.product_name}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-amber-600">
                                {formatTaka(o.due_amount)}
                              </td>
                              {amountValid && (
                                <td
                                  className={`px-3 py-2 text-right tabular-nums font-medium ${
                                    alloc > 0 ? "text-green-600" : "text-muted-foreground"
                                  }`}
                                >
                                  {alloc > 0 ? formatTaka(alloc) : "—"}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
