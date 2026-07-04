"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";

import { createReturnSchema, type CreateReturnInput } from "@/lib/schemas/return";
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

type Return = {
  id: number;
  order_id: number;
  customer_id: number;
  product_id: number;
  quantity: number;
  reason: string | null;
  returned_at: string;
  note: string | null;
  customer_name: string | null;
  product_name: string | null;
  product_unit: string | null;
  partner_name?: string | null;
};

type Order = {
  id: number;
  customer_name: string | null;
  product_name: string | null;
  quantity: number;
  status: string;
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const form = useForm<CreateReturnInput>({
    resolver: zodResolver(createReturnSchema),
    defaultValues: {
      order_id: 0,
      quantity: 1,
      reason: "",
      returned_at: new Date().toISOString().slice(0, 10),
      note: "",
    },
  });

  const orderId = useWatch({ control: form.control, name: "order_id", defaultValue: 0 });
  const selectedOrder = orders.find((o) => o.id === orderId);
  const selectedOrderLabel = selectedOrder
    ? `#${selectedOrder.id} — ${selectedOrder.customer_name} (${selectedOrder.product_name})`
    : undefined;

  useEffect(() => {
    fetch("/api/returns")
      .then((res) => res.json())
      .then((data) => {
        setReturns(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setIsAdmin(data.user?.role === "admin"))
      .catch(() => setIsAdmin(false));
    // Load delivered + paid orders as returnable
    Promise.all([
      fetch("/api/orders?status=delivered").then((res) => res.json()),
      fetch("/api/orders?status=paid").then((res) => res.json()),
    ]).then(([delivered, paid]: [Order[], Order[]]) => setOrders([...delivered, ...paid]));
  }, []);

  async function refreshReturns() {
    const res = await fetch("/api/returns");
    setReturns(await res.json());
  }

  function openCreate() {
    form.reset({
      order_id: 0,
      quantity: 1,
      reason: "",
      returned_at: new Date().toISOString().slice(0, 10),
      note: "",
    });
    setCreateOpen(true);
  }

  async function onSubmit(data: CreateReturnInput) {
    const res = await fetch("/api/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Return logged");
      setCreateOpen(false);
      refreshReturns();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to log return");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Returns</h1>
          <p className="text-sm text-muted-foreground">Log failed or damaged deliveries.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="size-4" />
          Log Return
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Partner</TableHead>}
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 6 : 5}
                  className="text-center text-muted-foreground py-10"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : returns.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 6 : 5}
                  className="text-center text-muted-foreground py-10"
                >
                  No returns yet
                </TableCell>
              </TableRow>
            ) : (
              returns.map((r) => (
                <TableRow key={r.id}>
                  {isAdmin && <TableCell>{r.partner_name ?? "—"}</TableCell>}
                  <TableCell className="font-medium">{r.customer_name ?? "—"}</TableCell>
                  <TableCell>
                    {r.product_name ?? "—"}
                    {r.product_unit && (
                      <span className="text-muted-foreground text-xs ml-1">({r.product_unit})</span>
                    )}
                  </TableCell>
                  <TableCell>{r.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">{r.reason ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.returned_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Log Return</SheetTitle>
          </SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5 px-4 pb-8">
            <Field
              label="Order"
              error={
                (form.formState.errors as Record<string, { message?: string }>).order_id?.message
              }
            >
              <Select
                value={orderId ? String(orderId) : ""}
                onValueChange={(v) =>
                  form.setValue("order_id", Number(v), { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select order">
                    {selectedOrderLabel ?? undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      #{o.id} — {o.customer_name} ({o.product_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Quantity" error={form.formState.errors.quantity?.message}>
              <Input
                type="number"
                min={1}
                max={selectedOrder?.quantity}
                {...form.register("quantity", { valueAsNumber: true })}
              />
              {selectedOrder && (
                <p className="text-xs text-muted-foreground">Max: {selectedOrder.quantity}</p>
              )}
            </Field>

            <Field label="Reason">
              <Input placeholder="Damaged, wrong order…" {...form.register("reason")} />
            </Field>

            <Field label="Return Date" error={form.formState.errors.returned_at?.message}>
              <Input type="date" {...form.register("returned_at")} />
            </Field>

            <Field label="Note">
              <Textarea {...form.register("note")} />
            </Field>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-1/2">
                {form.formState.isSubmitting ? "Saving…" : "Log Return"}
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
