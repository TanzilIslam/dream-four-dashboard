"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  PlusIcon,
  Truck,
  BanknoteIcon,
  XCircle,
  ChevronsUpDown,
  Check,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { z } from "zod";
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [filters, setFilters] = useState({
    status: "due",
    product_id: "all",
    area_id: "all",
    customer_search: "",
    partner_name: "all",
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [deliverTarget, setDeliverTarget] = useState<Order | null>(null);
  const [delivering, setDelivering] = useState(false);

  const createForm = useForm<z.input<typeof createOrderSchema>, unknown, CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customer_id: 0,
      product_id: 0,
      quantity: 1,
      unit_price: 0,
      paid_amount: 0,
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
  const watchQuantity = useWatch({
    control: createForm.control,
    name: "quantity",
    defaultValue: 1,
  });
  const watchUnitPrice = useWatch({
    control: createForm.control,
    name: "unit_price",
    defaultValue: 0,
  });
  const watchPaidAmount = useWatch({
    control: createForm.control,
    name: "paid_amount",
    defaultValue: 0,
  });
  const orderTotal = (watchQuantity || 0) * (watchUnitPrice || 0);
  const orderDue = Math.max(0, orderTotal - (watchPaidAmount || 0));
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

  const apiStatus = filters.status === "due" ? "all" : filters.status;

  useEffect(() => {
    fetch(`/api/orders?status=${apiStatus}`)
      .then((res) => res.json())
      .then((data) => {
        setOrders(data);
        setLoading(false);
      });
  }, [apiStatus]);

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
      .then((data: Product[]) => {
        setProducts(data);
        if (data.length > 0) setFilters((prev) => ({ ...prev, product_id: String(data[0].id) }));
      });
    fetch("/api/settings/pricing-tiers")
      .then((res) => res.json())
      .then((data: Tier[]) => setTiers(data));
    fetch("/api/stock")
      .then((res) => res.json())
      .then((data: StockItem[]) => setStock(data));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  async function refreshOrders() {
    const [ordersRes, stockRes] = await Promise.all([
      fetch(`/api/orders?status=${apiStatus}`),
      fetch("/api/stock"),
    ]);
    setOrders(await ordersRes.json());
    setStock(await stockRes.json());
  }

  function setFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const defaultProductId = products.length > 0 ? String(products[0].id) : "all";

  function clearFilters() {
    setFilters({
      status: "due",
      product_id: defaultProductId,
      area_id: "all",
      customer_search: "",
      partner_name: "all",
    });
  }

  // Derive unique areas and partners from loaded orders
  const uniqueAreas = [
    ...new Map(
      orders
        .filter((o) => o.area_name)
        .map((o) => [o.area_id, { id: o.area_id, name: o.area_name! }])
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const uniquePartners = [
    ...new Set(orders.filter((o) => o.partner_name).map((o) => o.partner_name!)),
  ].sort();

  const activeFilterCount = [
    filters.status !== "due",
    filters.product_id !== defaultProductId,
    filters.area_id !== "all",
    filters.customer_search !== "",
    filters.partner_name !== "all",
  ].filter(Boolean).length;

  const filteredOrders = orders.filter((o) => {
    if (filters.status === "due" && Number(o.due_amount) <= 0) return false;
    if (filters.product_id !== "all" && String(o.product_id) !== filters.product_id) return false;
    if (filters.area_id !== "all" && String(o.area_id) !== filters.area_id) return false;
    if (
      filters.customer_search &&
      !(o.customer_name ?? "").toLowerCase().includes(filters.customer_search.toLowerCase())
    )
      return false;
    if (filters.partner_name !== "all" && o.partner_name !== filters.partner_name) return false;
    return true;
  });

  function openCreate() {
    createForm.reset({
      customer_id: 0,
      product_id: 0,
      quantity: 1,
      unit_price: 0,
      paid_amount: 0,
      note: "",
    });
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
          <p className="text-sm text-muted-foreground">
            Track deliveries and payments.
            {!loading && (
              <span className="ml-1 font-medium text-foreground">
                {filteredOrders.length}
                {filteredOrders.length !== orders.length ? ` of ${orders.length}` : ""} total
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterOpen((v) => !v)}
            className="relative"
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <PlusIcon className="size-4" />
            New Order
          </Button>
        </div>
      </div>

      {/* Stock summary — filtered by selected product */}
      {!loading && stock.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stock
            .filter((s) => filters.product_id === "all" || String(s.id) === filters.product_id)
            .map((s) => {
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

      {/* Desktop inline filter panel */}
      {filterOpen && !isMobile && (
        <div className="hidden md:block rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            <OrderFilterSection label="Status">
              <OrderFilterPills
                options={[
                  { label: "Due", value: "due" },
                  { label: "All", value: "all" },
                  { label: "Pending", value: "pending" },
                  { label: "Delivered", value: "delivered" },
                  { label: "Paid", value: "paid" },
                  { label: "Cancelled", value: "cancelled" },
                ]}
                value={filters.status}
                onChange={(v) => setFilter("status", v)}
              />
            </OrderFilterSection>
            <OrderFilterSection label="Customer">
              <Input
                placeholder="Search customer…"
                value={filters.customer_search}
                onChange={(e) => setFilter("customer_search", e.target.value)}
              />
            </OrderFilterSection>
            <OrderFilterSection label="Product">
              <Select value={filters.product_id} onValueChange={(v) => setFilter("product_id", v ?? "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {filters.product_id === "all"
                      ? "All products"
                      : (products.find((p) => String(p.id) === filters.product_id)?.name ?? "All products")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </OrderFilterSection>
            <OrderFilterSection label="Area">
              <Select value={filters.area_id} onValueChange={(v) => setFilter("area_id", v ?? "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {filters.area_id === "all"
                      ? "All areas"
                      : (uniqueAreas.find((a) => String(a.id) === filters.area_id)?.name ?? "All areas")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All areas</SelectItem>
                  {uniqueAreas.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </OrderFilterSection>
            {isAdmin && uniquePartners.length > 0 && (
              <OrderFilterSection label="Partner">
                <Select value={filters.partner_name} onValueChange={(v) => setFilter("partner_name", v ?? "all")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {filters.partner_name === "all" ? "All partners" : filters.partner_name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All partners</SelectItem>
                    {uniquePartners.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </OrderFilterSection>
            )}
          </div>
          {activeFilterCount > 0 && (
            <div className="flex justify-end">
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <X className="size-3" />
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-25" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  {activeFilterCount > 0 ? "No orders match your filters" : "No orders"}
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-muted-foreground text-xs">#{o.id}</TableCell>
                  <TableCell className="font-medium">{o.customer_name ?? "—"}</TableCell>
                  <TableCell>{o.quantity}</TableCell>
                  <TableCell>৳{Number(o.unit_price).toFixed(2)}</TableCell>
                  <TableCell>৳{Number(o.total_amount).toFixed(2)}</TableCell>
                  <TableCell>
                    {Number(o.paid_amount) > 0 ? (
                      <span className="text-green-600">৳{Number(o.paid_amount).toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
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

      {/* Filter sheet (mobile only) */}
      <Sheet open={filterOpen && isMobile} onOpenChange={(open) => !open && setFilterOpen(false)}>
        <SheetContent className="w-full sm:max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-6 px-4 pb-8 space-y-6">
            {/* Status */}
            <OrderFilterSection label="Status">
              <OrderFilterPills
                options={[
                  { label: "Due", value: "due" },
                  { label: "All", value: "all" },
                  { label: "Pending", value: "pending" },
                  { label: "Delivered", value: "delivered" },
                  { label: "Paid", value: "paid" },
                  { label: "Cancelled", value: "cancelled" },
                ]}
                value={filters.status}
                onChange={(v) => setFilter("status", v)}
              />
            </OrderFilterSection>

            {/* Customer */}
            <OrderFilterSection label="Customer">
              <Input
                placeholder="Search customer…"
                value={filters.customer_search}
                onChange={(e) => setFilter("customer_search", e.target.value)}
              />
            </OrderFilterSection>

            {/* Product */}
            <OrderFilterSection label="Product">
              <Select
                value={filters.product_id}
                onValueChange={(v) => setFilter("product_id", v ?? "all")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {filters.product_id === "all"
                      ? "All products"
                      : (products.find((p) => String(p.id) === filters.product_id)?.name ??
                        "All products")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </OrderFilterSection>

            {/* Area */}
            <OrderFilterSection label="Area">
              <Select
                value={filters.area_id}
                onValueChange={(v) => setFilter("area_id", v ?? "all")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {filters.area_id === "all"
                      ? "All areas"
                      : (uniqueAreas.find((a) => String(a.id) === filters.area_id)?.name ??
                        "All areas")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All areas</SelectItem>
                  {uniqueAreas.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </OrderFilterSection>

            {/* Partner (admin only) */}
            {isAdmin && uniquePartners.length > 0 && (
              <OrderFilterSection label="Partner">
                <Select
                  value={filters.partner_name}
                  onValueChange={(v) => setFilter("partner_name", v ?? "all")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {filters.partner_name === "all" ? "All partners" : filters.partner_name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All partners</SelectItem>
                    {uniquePartners.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </OrderFilterSection>
            )}

            {activeFilterCount > 0 && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <X className="size-3" />
                  Clear all
                </button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

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
              <CustomerSearch
                customers={customers}
                value={customerId}
                onChange={(id) => createForm.setValue("customer_id", id, { shouldValidate: true })}
              />
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

            <Field
              label="Paid Now (৳)"
              error={
                (createForm.formState.errors as Record<string, { message?: string }>).paid_amount
                  ?.message
              }
            >
              <Input
                type="number"
                step="0.01"
                min={0}
                {...createForm.register("paid_amount", { valueAsNumber: true })}
              />
            </Field>

            {orderTotal > 0 && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order total</span>
                  <span>৳{orderTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Due after payment</span>
                  <span className={orderDue > 0 ? "text-destructive" : "text-green-600"}>
                    ৳{orderDue.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

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

function CustomerSearch({
  customers,
  value,
  onChange,
}: {
  customers: Customer[];
  value: number;
  onChange: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const selected = customers.find((c) => c.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex items-center justify-between w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        onClick={() => {
          setOpen((o) => !o);
          setSearch("");
        }}
      >
        <span className={selected ? "" : "text-muted-foreground"}>
          {selected ? selected.name : "Select customer"}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="p-2">
            <input
              autoFocus
              className="w-full rounded-sm border border-input bg-background px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No customers found</li>
            ) : (
              filtered.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={() => {
                    onChange(c.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={`size-3.5 shrink-0 ${c.id === value ? "opacity-100" : "opacity-0"}`}
                  />
                  {c.name}
                  {c.area_name && (
                    <span className="ml-auto text-xs text-muted-foreground">{c.area_name}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
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

function OrderFilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function OrderFilterPills({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            value === o.value
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
