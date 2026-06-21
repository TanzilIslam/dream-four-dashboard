"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Truck, BanknoteIcon, XCircle } from "lucide-react";

import {
  createOrderSchema,
  payOrderSchema,
  cancelOrderSchema,
  type CreateOrderInput,
  type PayOrderInput,
  type CancelOrderInput,
} from "@/lib/schemas/order";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

type Order = {
  id: number;
  partner_id: number;
  customer_id: number;
  area_id: number;
  product_id: number;
  quantity: number;
  unit_price: string;
  total_amount: string;
  status: "pending" | "delivered" | "paid" | "cancelled";
  ordered_at: string;
  delivered_at: string | null;
  paid_amount: string;
  due_amount: string;
  payment_method: string | null;
  cancellation_reason: string | null;
  note: string | null;
  customer_name: string | null;
  area_name: string | null;
  product_name: string | null;
  product_unit: string | null;
  partner_name?: string | null;
};

type Customer = {
  id: number;
  name: string;
  area_id: number;
  area_name: string | null;
  pricing_tier_id: number | null;
  tier_name?: string | null;
};
type Product = { id: number; name: string; unit: string; default_price: string | null };
type Tier = { id: number; name: string; product_id: number; unit_price: string };
type StockItem = {
  id: number;
  name: string;
  unit: string;
  low_stock_threshold: number;
  available_qty: number;
  reserved_qty: number;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  delivered: "default",
  paid: "outline",
  cancelled: "destructive",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [deliverTarget, setDeliverTarget] = useState<Order | null>(null);
  const [delivering, setDelivering] = useState(false);

  const createForm = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customer_id: 0,
      product_id: 0,
      quantity: 1,
      unit_price: 0,
      note: "",
    },
  });

  const payForm = useForm<PayOrderInput>({
    resolver: zodResolver(payOrderSchema),
    defaultValues: {
      paid_amount: 0,
      payment_method: "",
      promised_payment_date: "",
      note: "",
    },
  });

  const cancelForm = useForm<CancelOrderInput>({
    resolver: zodResolver(cancelOrderSchema),
    defaultValues: { cancellation_reason: "" },
  });

  const customerId = useWatch({
    control: createForm.control,
    name: "customer_id",
    defaultValue: 0,
  });
  const productId = useWatch({ control: createForm.control, name: "product_id", defaultValue: 0 });
  const selectedCustomerName = customers.find((c) => c.id === customerId)?.name;
  const selectedProductName = products.find((p) => p.id === productId)?.name;

  // Auto-fill unit price based on customer's pricing tier or product default
  useEffect(() => {
    if (!customerId || !productId) return;
    const customer = customers.find((c) => c.id === customerId);
    const product = products.find((p) => p.id === productId);
    if (!customer || !product) return;

    const tier = tiers.find((t) => t.id === customer.pricing_tier_id && t.product_id === productId);
    const price = tier
      ? Number(tier.unit_price)
      : product.default_price
        ? Number(product.default_price)
        : 0;
    createForm.setValue("unit_price", price);
  }, [customerId, productId, customers, products, tiers, createForm]);

  useEffect(() => {
    fetch(`/api/orders?status=${statusFilter}`)
      .then((res) => res.json())
      .then((data) => {
        setOrders(data);
        setLoading(false);
      });
  }, [statusFilter]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setIsAdmin(data.user?.role === "admin"))
      .catch(() => setIsAdmin(false));
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data: Customer[]) => setCustomers(data));
    fetch("/api/settings/products")
      .then((res) => res.json())
      .then((data: Product[]) => setProducts(data));
    fetch("/api/settings/pricing-tiers")
      .then((res) => res.json())
      .then((data: Tier[]) => setTiers(data));
    fetch("/api/stock")
      .then((res) => res.json())
      .then((data: StockItem[]) => setStock(data));
  }, []);

  async function refreshOrders() {
    const [ordersRes, stockRes] = await Promise.all([
      fetch(`/api/orders?status=${statusFilter}`),
      fetch("/api/stock"),
    ]);
    setOrders(await ordersRes.json());
    setStock(await stockRes.json());
  }

  function openCreate() {
    createForm.reset({ customer_id: 0, product_id: 0, quantity: 1, unit_price: 0, note: "" });
    setCreateOpen(true);
  }

  async function onCreateSubmit(data: CreateOrderInput) {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Order created");
      setCreateOpen(false);
      refreshOrders();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to create order");
    }
  }

  async function handleDeliver() {
    if (!deliverTarget) return;
    setDelivering(true);
    const res = await fetch(`/api/orders/${deliverTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deliver" }),
    });
    if (res.ok) {
      toast.success("Order marked as delivered");
      setDeliverTarget(null);
      refreshOrders();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to update");
    }
    setDelivering(false);
  }

  async function onPaySubmit(data: PayOrderInput) {
    if (!payTarget) return;
    const res = await fetch(`/api/orders/${payTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pay", ...data }),
    });
    if (res.ok) {
      toast.success("Payment recorded");
      setPayTarget(null);
      refreshOrders();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to record payment");
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    const data = cancelForm.getValues();
    const res = await fetch(`/api/orders/${cancelTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", ...data }),
    });
    if (res.ok) {
      toast.success("Order cancelled");
      setCancelTarget(null);
      refreshOrders();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to cancel");
    }
    setCancelling(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">Track deliveries and payments.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="size-4" />
          New Order
        </Button>
      </div>

      {/* Stock summary */}
      {stock.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stock.map((s) => {
            const low = s.available_qty <= s.low_stock_threshold;
            return (
              <div
                key={s.id}
                className={`rounded-md border px-3 py-1.5 text-sm flex items-center gap-2 ${low ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-muted/40"}`}
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">
                  {s.available_qty} {s.unit} available
                  {s.reserved_qty > 0 && ` · ${s.reserved_qty} reserved`}
                </span>
                {low && <span className="text-xs font-medium">Low stock</span>}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Filter:</Label>
        <Select value={statusFilter} onValueChange={(v) => v != null && setStatusFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Partner</TableHead>}
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 8 : 7}
                  className="text-center text-muted-foreground py-10"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 8 : 7}
                  className="text-center text-muted-foreground py-10"
                >
                  No orders
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
                <TableRow key={o.id}>
                  {isAdmin && <TableCell>{o.partner_name ?? "—"}</TableCell>}
                  <TableCell className="font-medium">{o.customer_name ?? "—"}</TableCell>
                  <TableCell>
                    {o.product_name ?? "—"}
                    {o.product_unit && (
                      <span className="text-muted-foreground text-xs ml-1">({o.product_unit})</span>
                    )}
                  </TableCell>
                  <TableCell>{o.quantity}</TableCell>
                  <TableCell>৳{Number(o.total_amount).toFixed(2)}</TableCell>
                  <TableCell>
                    {Number(o.due_amount) > 0 ? (
                      <span className="text-destructive">৳{Number(o.due_amount).toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[o.status] ?? "secondary"}>{o.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {o.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeliverTarget(o)}
                          className="size-7 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          title="Mark delivered"
                        >
                          <Truck className="size-3.5" />
                        </Button>
                      )}
                      {(o.status === "pending" || o.status === "delivered") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            payForm.reset({
                              paid_amount: Number(o.due_amount),
                              payment_method: "",
                              promised_payment_date: "",
                              note: "",
                            });
                            setPayTarget(o);
                          }}
                          className="size-7 text-green-600 hover:bg-green-50 hover:text-green-700"
                          title="Record payment"
                        >
                          <BanknoteIcon className="size-3.5" />
                        </Button>
                      )}
                      {o.status !== "paid" && o.status !== "cancelled" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            cancelForm.reset({ cancellation_reason: "" });
                            setCancelTarget(o);
                          }}
                          className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          title="Cancel order"
                        >
                          <XCircle className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create order sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Order</SheetTitle>
          </SheetHeader>
          <form
            onSubmit={createForm.handleSubmit(onCreateSubmit)}
            className="mt-6 space-y-5 px-4 pb-8"
          >
            <Field
              label="Customer"
              error={
                (createForm.formState.errors as Record<string, { message?: string }>).customer_id
                  ?.message
              }
            >
              <Select
                value={customerId ? String(customerId) : ""}
                onValueChange={(v) =>
                  createForm.setValue("customer_id", Number(v), { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select customer">
                    {selectedCustomerName ?? undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Product"
              error={
                (createForm.formState.errors as Record<string, { message?: string }>).product_id
                  ?.message
              }
            >
              <Select
                value={productId ? String(productId) : ""}
                onValueChange={(v) =>
                  createForm.setValue("product_id", Number(v), { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select product">
                    {selectedProductName ?? undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({p.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Quantity" error={createForm.formState.errors.quantity?.message}>
              <Input
                type="number"
                min={1}
                {...createForm.register("quantity", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Unit Price (৳)" error={createForm.formState.errors.unit_price?.message}>
              <Input
                type="number"
                step="0.01"
                {...createForm.register("unit_price", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Note">
              <Textarea placeholder="Optional note…" {...createForm.register("note")} />
            </Field>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={createForm.formState.isSubmitting} className="w-1/2">
                {createForm.formState.isSubmitting ? "Creating…" : "Create Order"}
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

      {/* Payment sheet */}
      <Sheet open={payTarget !== null} onOpenChange={(open) => !open && setPayTarget(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Record Payment</SheetTitle>
          </SheetHeader>
          {payTarget && (
            <div className="px-4 pt-3 text-sm text-muted-foreground">
              Order: {payTarget.customer_name} — Due: ৳{Number(payTarget.due_amount).toFixed(2)}
            </div>
          )}
          <form onSubmit={payForm.handleSubmit(onPaySubmit)} className="mt-4 space-y-5 px-4 pb-8">
            <Field label="Amount Paid (৳)" error={payForm.formState.errors.paid_amount?.message}>
              <Input
                type="number"
                step="0.01"
                {...payForm.register("paid_amount", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Payment Method">
              <Input placeholder="Cash, bKash, bank…" {...payForm.register("payment_method")} />
            </Field>

            <Field label="Promised Payment Date">
              <Input type="date" {...payForm.register("promised_payment_date")} />
            </Field>

            <Field label="Note">
              <Textarea {...payForm.register("note")} />
            </Field>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={payForm.formState.isSubmitting} className="w-1/2">
                {payForm.formState.isSubmitting ? "Saving…" : "Record Payment"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPayTarget(null)}
                className="w-1/2"
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Deliver confirm */}
      <ConfirmDialog
        open={deliverTarget !== null}
        onOpenChange={(open) => !open && setDeliverTarget(null)}
        title="Mark as Delivered"
        description={`Mark order for "${deliverTarget?.customer_name}" as delivered?`}
        confirmLabel="Mark Delivered"
        loading={delivering}
        onConfirm={handleDeliver}
      />

      {/* Cancel order sheet */}
      <Sheet open={cancelTarget !== null} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Cancel Order</SheetTitle>
          </SheetHeader>
          <form className="mt-6 space-y-5 px-4 pb-8">
            <Field label="Reason (optional)">
              <Textarea
                placeholder="Why is this order being cancelled?"
                {...cancelForm.register("cancellation_reason")}
              />
            </Field>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={cancelling}
                onClick={handleCancel}
                className="w-1/2"
              >
                {cancelling ? "Cancelling…" : "Cancel Order"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelTarget(null)}
                className="w-1/2"
              >
                Go Back
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
