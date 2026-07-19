"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  PlusIcon,
  Pencil,
  Power,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  X,
  Eye,
  BanknoteIcon,
  Download,
  Link,
} from "lucide-react";

import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@/lib/schemas/customer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  area_id: number;
  area_name: string | null;
  pricing_tier_id: number | null;
  tier_name: string | null;
  tier_unit_price: string | null;
  tier_min_qty: number | null;
  tier_product_unit: string | null;
  partner_name: string | null;
  product_id: number | null;
  product_name: string | null;
  due_allowed: boolean;
  max_due: string;
  delivery_frequency: string;
  delivery_interval: number;
  customer_type: "home" | "confectionery" | "hotel" | "restaurant" | "madrasha" | null;
  notes: string | null;
  is_active: boolean;
  total_orders: number;
  total_quantity: number;
  total_paid: string;
  total_due: string;
  total_assets_sent: number;
  unreturned_assets: number;
  last_order_date: string | null;
};

type CustomerHistoryOrder = {
  id: number;
  ordered_at: string;
  delivered_at: string | null;
  status: string;
  quantity: number;
  unit_price: string;
  total_amount: string;
  paid_amount: string;
  due_amount: string;
  note: string | null;
  payments: {
    id: number;
    amount: string;
    payment_method: string | null;
    paid_at: string;
    note: string | null;
  }[];
};

type CustomerHistoryProduct = {
  product_id: number;
  product_name: string;
  product_unit: string;
  total_orders: number;
  total_qty: number;
  total_amount: number;
  total_paid: number;
  total_due: number;
  orders: CustomerHistoryOrder[];
};

type Area = { id: number; name: string };
type Tier = { id: number; name: string; unit_price: string; min_qty: number; product_unit: string };

type Mode = "create" | "edit";

type Product = { id: number; name: string };

type Filters = {
  search: string;
  area_id: string;
  customer_type: string;
  pricing_tier_id: string;
  due_allowed: string;
  status: string;
  delivery_frequency: string;
  product_id: string;
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  area_id: "all",
  customer_type: "all",
  pricing_tier_id: "all",
  due_allowed: "all",
  status: "all",
  delivery_frequency: "all",
  product_id: "all",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentDefaults, setPaymentDefaults] = useState<{
    due_allowed: boolean;
    max_due_per_customer: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Customer | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [customerHistory, setCustomerHistory] = useState<CustomerHistoryProduct[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentList, setPaymentList] = useState<
    {
      id: number;
      amount: string;
      paid_at: string;
      payment_method: string | null;
      product_name: string;
    }[]
  >([]);
  const [deliveredOrders, setDeliveredOrders] = useState<
    {
      id: number;
      delivered_at: string | null;
      quantity: number;
      unit_price: string;
      total_amount: string;
      paid_amount: string;
      due_amount: string;
      product_name: string;
      assets_sent: number;
      assets_returned: number;
    }[]
  >([]);
  const [paymentListLoading, setPaymentListLoading] = useState(false);
  const [customerSheetTab, setCustomerSheetTab] = useState<string>("payments");
  const [nameSortDir, setNameSortDir] = useState<"asc" | "desc">("asc");
  const [orderSort, setOrderSort] = useState<
    | "none"
    | "orders_desc"
    | "orders_asc"
    | "qty_desc"
    | "qty_asc"
    | "due_desc"
    | "due_asc"
    | "paid_desc"
    | "paid_asc"
    | "last_order_desc"
    | "last_order_asc"
    | "assets_desc"
    | "assets_asc"
    | "created_desc"
    | "created_asc"
  >("created_desc");

  const statusParam = filters.status; // "all" | "active" | "inactive"

  const createForm = useForm<CreateCustomerInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createCustomerSchema) as any,
    defaultValues: {
      name: "",
      phone: "",
      whatsapp: "",
      address: "",
      area_id: 0,
      pricing_tier_id: null,
      due_allowed: true,
      max_due: 1000,
      delivery_frequency: "daily",
      delivery_interval: 1,
      notes: "",
      is_active: true,
    },
  });

  const editForm = useForm<UpdateCustomerInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(updateCustomerSchema) as any,
  });

  const form = mode === "create" ? createForm : editForm;

  const createAreaId = useWatch({ control: createForm.control, name: "area_id", defaultValue: 0 });
  const editAreaId = useWatch({ control: editForm.control, name: "area_id", defaultValue: 0 });
  const areaId = mode === "create" ? createAreaId : editAreaId;

  const createDueAllowed = useWatch({
    control: createForm.control,
    name: "due_allowed",
    defaultValue: true,
  });
  const editDueAllowed = useWatch({
    control: editForm.control,
    name: "due_allowed",
    defaultValue: true,
  });
  const dueAllowed = mode === "create" ? createDueAllowed : editDueAllowed;

  const createIsActive = useWatch({
    control: createForm.control,
    name: "is_active",
    defaultValue: true,
  });
  const editIsActive = useWatch({
    control: editForm.control,
    name: "is_active",
    defaultValue: true,
  });
  const isActive = mode === "create" ? createIsActive : editIsActive;

  const createTierId = useWatch({
    control: createForm.control,
    name: "pricing_tier_id",
    defaultValue: null,
  });
  const editTierId = useWatch({
    control: editForm.control,
    name: "pricing_tier_id",
    defaultValue: null,
  });
  const selectedTierId = mode === "create" ? createTierId : editTierId;

  const createDeliveryFreq = useWatch({
    control: createForm.control,
    name: "delivery_frequency",
    defaultValue: "daily",
  });
  const editDeliveryFreq = useWatch({
    control: editForm.control,
    name: "delivery_frequency",
    defaultValue: "daily",
  });
  const deliveryFrequency =
    ((mode === "create" ? createDeliveryFreq : editDeliveryFreq) as string) ?? "daily";

  const createCustomerType = useWatch({
    control: createForm.control,
    name: "customer_type",
    defaultValue: null,
  });
  const editCustomerType = useWatch({
    control: editForm.control,
    name: "customer_type",
    defaultValue: null,
  });
  const customerType = mode === "create" ? createCustomerType : editCustomerType;

  const selectedAreaName = areas.find((a) => a.id === areaId)?.name;
  const selectedTier = tiers.find((t) => t.id === selectedTierId);
  const selectedTierLabel = selectedTier
    ? `${selectedTier.name}-${selectedTier.unit_price}tk-${selectedTier.min_qty}${selectedTier.product_unit}`
    : null;

  // Active filter count (excludes defaults)
  const activeFilterCount = [
    filters.search !== "",
    filters.status !== "all",
    filters.product_id !== "all",
    filters.area_id !== "all",
    filters.customer_type !== "all",
    filters.pricing_tier_id !== "all",
  ].filter(Boolean).length;

  // Frontend filtering + sorting
  const filteredCustomers = [...customers]
    .filter((c) => {
      if (
        filters.search &&
        !c.name.toLowerCase().includes(filters.search.toLowerCase()) &&
        !(c.phone ?? "").includes(filters.search)
      )
        return false;
      if (filters.product_id !== "all" && String(c.product_id ?? "none") !== filters.product_id)
        return false;
      if (filters.area_id !== "all" && String(c.area_id) !== filters.area_id) return false;
      if (filters.customer_type !== "all" && (c.customer_type ?? "none") !== filters.customer_type)
        return false;
      if (
        filters.pricing_tier_id !== "all" &&
        String(c.pricing_tier_id ?? "none") !== filters.pricing_tier_id
      )
        return false;
      if (filters.due_allowed !== "all") {
        if (filters.due_allowed === "yes" && !c.due_allowed) return false;
        if (filters.due_allowed === "no" && c.due_allowed) return false;
      }
      if (filters.status !== "all") {
        if (filters.status === "active" && !c.is_active) return false;
        if (filters.status === "inactive" && c.is_active) return false;
      }
      if (
        filters.delivery_frequency !== "all" &&
        c.delivery_frequency !== filters.delivery_frequency
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      switch (orderSort) {
        case "orders_desc":
          return b.total_orders - a.total_orders;
        case "orders_asc":
          return a.total_orders - b.total_orders;
        case "qty_desc":
          return b.total_quantity - a.total_quantity;
        case "qty_asc":
          return a.total_quantity - b.total_quantity;
        case "due_desc":
          return Number(b.total_due) - Number(a.total_due);
        case "due_asc":
          return Number(a.total_due) - Number(b.total_due);
        case "paid_desc":
          return Number(b.total_paid) - Number(a.total_paid);
        case "paid_asc":
          return Number(a.total_paid) - Number(b.total_paid);
        case "last_order_desc":
          return (b.last_order_date ?? "").localeCompare(a.last_order_date ?? "");
        case "last_order_asc":
          return (a.last_order_date ?? "").localeCompare(b.last_order_date ?? "");
        case "assets_desc":
          return b.unreturned_assets - a.unreturned_assets;
        case "assets_asc":
          return a.unreturned_assets - b.unreturned_assets;
        case "created_desc":
          return b.id - a.id;
        case "created_asc":
          return a.id - b.id;
        default:
          return nameSortDir === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
      }
    });

  useEffect(() => {
    fetch(`/api/customers?status=${statusParam}`)
      .then((res) => res.json())
      .then((data) => {
        setCustomers(data);
        setLoading(false);
      });
  }, [statusParam]);

  useEffect(() => {
    fetch("/api/settings/areas")
      .then((res) => res.json())
      .then((data) => setAreas(data));
    fetch("/api/settings/pricing-tiers")
      .then((res) => res.json())
      .then((data) => setTiers(data));
    fetch("/api/settings/products")
      .then((res) => res.json())
      .then((data) => setProducts(data));
    fetch("/api/settings/payment-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setPaymentDefaults(data));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!viewingCustomer) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryLoading(true);
    fetch(`/api/customers/${viewingCustomer.id}/history`)
      .then((r) => r.json())
      .then((data) => setCustomerHistory(data.products))
      .finally(() => setHistoryLoading(false));
  }, [viewingCustomer]);

  useEffect(() => {
    if (!paymentCustomer) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPaymentListLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomerSheetTab("payments");
    fetch(`/api/customers/${paymentCustomer.id}/payments`)
      .then((r) => r.json())
      .then((data) => {
        setPaymentList(data.payments ?? []);
        setDeliveredOrders(data.orders ?? []);
      })
      .finally(() => setPaymentListLoading(false));
  }, [paymentCustomer]);

  async function exportLedger() {
    if (!paymentCustomer) return;
    try {
      const { utils, writeFile } = await import("xlsx");

      type LedgerEntry = {
        date: Date;
        type: "delivery" | "payment";
        details: string;
        qty: number | null;
        rate: number | null;
        purchase: number;
        paid: number;
        assetSent: number;
        assetReturned: number;
      };

      const entries: LedgerEntry[] = [];

      for (const o of deliveredOrders) {
        entries.push({
          date: new Date(o.delivered_at ?? o.id),
          type: "delivery",
          details: o.product_name,
          qty: o.quantity,
          rate: Number(o.unit_price),
          purchase: Number(o.total_amount),
          paid: 0,
          assetSent: o.assets_sent ?? 0,
          assetReturned: o.assets_returned ?? 0,
        });
      }

      for (const p of paymentList) {
        entries.push({
          date: new Date(p.paid_at),
          type: "payment",
          details: `Payment (${p.payment_method ?? "Cash"})`,
          qty: null,
          rate: null,
          purchase: 0,
          paid: Number(p.amount),
          assetSent: 0,
          assetReturned: 0,
        });
      }

      // Sort by date (day only); within same day, deliveries before payments
      const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      entries.sort((a, b) => {
        const da = dayKey(a.date), db = dayKey(b.date);
        if (da !== db) return a.date.getTime() - b.date.getTime();
        if (a.type === "delivery" && b.type === "payment") return -1;
        if (a.type === "payment" && b.type === "delivery") return 1;
        return 0;
      });

      const shortDate = (d: Date) =>
        d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });

      const hasAssets = entries.some((e) => e.assetSent > 0 || e.assetReturned > 0);

      const aoa: (string | number | null)[][] = [];

      // Header rows
      const colCount = hasAssets ? 12 : 9;
      aoa.push([paymentCustomer.name]);

      // Column headers
      const headers = ["Date", "Details", "Qty", "Rate", "Total", "Paid", "Due"];
      if (hasAssets) headers.push("Received", "Returned", "In Hand");
      headers.push("Customer Sign", "Staff Sign");
      aoa.push(headers);

      // Data rows with running balance
      let balance = 0;
      let totalPurchase = 0;
      let totalPaid = 0;
      let assetBalance = 0;
      let totalAssetSent = 0;
      let totalAssetReturned = 0;

      for (const e of entries) {
        balance += e.purchase - e.paid;
        totalPurchase += e.purchase;
        totalPaid += e.paid;
        assetBalance += e.assetSent - e.assetReturned;
        totalAssetSent += e.assetSent;
        totalAssetReturned += e.assetReturned;

        const row: (string | number | null)[] = [
          shortDate(e.date),
          e.details,
          e.qty,
          e.rate,
          e.purchase || null,
          e.paid || null,
          Math.round(balance * 100) / 100,
        ];
        if (hasAssets) {
          row.push(e.assetSent || null, e.assetReturned || null, assetBalance);
        }
        aoa.push(row);
      }

      const ws = utils.aoa_to_sheet(aoa);

      // Merge header row across all columns
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }];

      // Column widths
      const cols = [
        { wch: 14 }, // Date
        { wch: 22 }, // Details
        { wch: 6 }, // Qty
        { wch: 8 }, // Rate
        { wch: 14 }, // Purchase
        { wch: 14 }, // Paid
        { wch: 14 }, // Balance
      ];
      if (hasAssets) {
        cols.push({ wch: 12 }, { wch: 14 }, { wch: 14 });
      }
      cols.push({ wch: 16 }, { wch: 16 });
      ws["!cols"] = cols;

      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Ledger");
      writeFile(wb, `${paymentCustomer.name}_Ledger.xlsx`);
      toast.success("Ledger downloaded");
    } catch {
      toast.error("Failed to export ledger");
    }
  }

  async function refreshCustomers() {
    const res = await fetch(`/api/customers?status=${statusParam}`);
    setCustomers(await res.json());
  }

  function openCreate() {
    setMode("create");
    setEditingId(null);
    createForm.reset({
      name: "",
      phone: "",
      whatsapp: "",
      address: "",
      area_id: 0,
      pricing_tier_id: null,
      due_allowed: paymentDefaults?.due_allowed ?? true,
      max_due: paymentDefaults ? Number(paymentDefaults.max_due_per_customer) : 1000,
      delivery_frequency: "daily",
      delivery_interval: 1,
      customer_type: null,
      notes: "",
      is_active: true,
    });
    setSheetOpen(true);
  }

  function openEdit(c: Customer) {
    setMode("edit");
    setEditingId(c.id);
    editForm.reset({
      name: c.name,
      phone: c.phone ?? "",
      whatsapp: c.whatsapp ?? "",
      address: c.address ?? "",
      area_id: c.area_id,
      pricing_tier_id: c.pricing_tier_id,
      due_allowed: c.due_allowed,
      max_due: Number(c.max_due),
      delivery_frequency: c.delivery_frequency as "daily" | "alternate" | "weekly",
      delivery_interval: c.delivery_interval,
      customer_type: c.customer_type ?? null,
      notes: c.notes ?? "",
      is_active: c.is_active,
    });
    setSheetOpen(true);
  }

  async function onSubmit(data: CreateCustomerInput | UpdateCustomerInput) {
    const url = mode === "create" ? "/api/customers" : `/api/customers/${editingId}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success(mode === "create" ? "Customer added" : "Customer updated");
      setSheetOpen(false);
      refreshCustomers();
    } else {
      const json = await res.json().catch(() => null);
      toast.error(json?.error ?? "Something went wrong");
    }
  }

  async function handleDeactivateConfirmed() {
    if (!confirmTarget) return;
    setConfirming(true);
    const res = await fetch(`/api/customers/${confirmTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Customer deactivated");
      setConfirmTarget(null);
      refreshCustomers();
    } else {
      toast.error("Failed to deactivate");
    }
    setConfirming(false);
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div>
          <h1 className="text-xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Manage your delivery customers.
            {!loading && (
              <span className="ml-1 font-medium text-foreground">
                {filteredCustomers.length}
                {filteredCustomers.length !== customers.length
                  ? ` of ${customers.length}`
                  : ""}{" "}
                total
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={orderSort} onValueChange={(v) => setOrderSort(v as typeof orderSort)}>
            <SelectTrigger className="h-8 text-sm w-full sm:w-48">
              <SelectValue>
                {
                  {
                    none: "Sort by name",
                    orders_desc: "Orders: high to low",
                    orders_asc: "Orders: low to high",
                    qty_desc: "Qty: high to low",
                    qty_asc: "Qty: low to high",
                    due_desc: "Due: high to low",
                    due_asc: "Due: low to high",
                    paid_desc: "Paid: high to low",
                    paid_asc: "Paid: low to high",
                    last_order_desc: "Last order: newest",
                    last_order_asc: "Last order: oldest",
                    assets_desc: "Assets: high to low",
                    assets_asc: "Assets: low to high",
                    created_desc: "Created: newest first",
                    created_asc: "Created: oldest first",
                  }[orderSort]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sort by name</SelectItem>
              <SelectItem value="orders_desc">Orders: high to low</SelectItem>
              <SelectItem value="orders_asc">Orders: low to high</SelectItem>
              <SelectItem value="qty_desc">Qty: high to low</SelectItem>
              <SelectItem value="qty_asc">Qty: low to high</SelectItem>
              <SelectItem value="due_desc">Due: high to low</SelectItem>
              <SelectItem value="due_asc">Due: low to high</SelectItem>
              <SelectItem value="paid_desc">Paid: high to low</SelectItem>
              <SelectItem value="paid_asc">Paid: low to high</SelectItem>
              <SelectItem value="last_order_desc">Last order: newest</SelectItem>
              <SelectItem value="last_order_asc">Last order: oldest</SelectItem>
              <SelectItem value="assets_desc">Assets: high to low</SelectItem>
              <SelectItem value="assets_asc">Assets: low to high</SelectItem>
              <SelectItem value="created_desc">Created: newest first</SelectItem>
              <SelectItem value="created_asc">Created: oldest first</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterOpen((v) => !v)}
            className="relative md:hidden"
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
            Add Customer
          </Button>
        </div>
      </div>

      {/* Desktop inline filter bar */}
      <div className="hidden md:block">
        <Input
          placeholder="Search by name or phone…"
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-foreground text-inherit"
                  onClick={() => setNameSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                >
                  Name
                  {nameSortDir === "asc" ? (
                    <ArrowUp className="size-3" />
                  ) : (
                    <ArrowDown className="size-3" />
                  )}
                </button>
              </TableHead>
              {/* <TableHead>Type</TableHead> */}
              {/* <TableHead>Area</TableHead> */}
              <TableHead>Phone</TableHead>
              {/* <TableHead className="text-right">Orders</TableHead> */}
              {/* <TableHead className="text-right">Qty</TableHead> */}
              <TableHead>Summary</TableHead>
              <TableHead className="text-right">Last Order</TableHead>
              <TableHead className="text-right">Total Assets</TableHead>
              <TableHead className="text-right">Assets to Return</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  {activeFilterCount > 0 ? "No customers match your filters" : "No customers yet"}
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  {/* <TableCell>
                    {c.customer_type ? (
                      <Badge variant="outline" className="capitalize">
                        {c.customer_type}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell> */}
                  {/* <TableCell>{c.area_name ?? "—"}</TableCell> */}
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  {/* <TableCell className="text-right tabular-nums">{c.total_orders}</TableCell> */}
                  {/* <TableCell className="text-right tabular-nums">{c.total_quantity}</TableCell> */}
                  <TableCell className="text-sm space-y-0.5 tabular-nums">
                    <div>
                      <span className="text-muted-foreground">Sold:</span> ৳
                      {(Number(c.total_paid) + Number(c.total_due)).toFixed(0)} ({c.total_quantity}{" "}
                      unit)
                    </div>
                    <div>
                      <span className="text-muted-foreground">Paid:</span>{" "}
                      <span className="text-green-600">৳{Number(c.total_paid).toFixed(0)}</span>
                    </div>
                    {Number(c.total_due) > 0 && (
                      <div>
                        <span className="text-muted-foreground">Due:</span>{" "}
                        <span className="text-destructive">৳{Number(c.total_due).toFixed(0)}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                    {formatDate(c.last_order_date)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.total_assets_sent > 0 ? c.total_assets_sent : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.unreturned_assets > 0 ? (
                      <span className="text-destructive font-medium">{c.unreturned_assets}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewingCustomer(c)}
                        className="size-7 hover:bg-muted"
                        title="View details"
                      >
                        <Eye className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPaymentCustomer(c)}
                        className="size-7 text-green-600 hover:bg-green-50 hover:text-green-700"
                        title="Payment history"
                      >
                        <BanknoteIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/score?name=${encodeURIComponent(c.name)}`;
                          try {
                            await navigator.clipboard.writeText(publicUrl);
                            toast.success(`Link copied: ${c.name}`);
                          } catch {
                            toast.error("Failed to copy link");
                          }
                        }}
                        className="size-7 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        title="Copy public score link"
                      >
                        <Link className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(c)}
                        className="size-7 hover:bg-muted"
                        title="Edit customer"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {c.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmTarget(c)}
                          className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Power className="size-3.5" />
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

      {/* ── Filter Sheet (mobile only) ────────────────────────────── */}
      <Sheet open={filterOpen && isMobile} onOpenChange={(open) => !open && setFilterOpen(false)}>
        <SheetContent className="!w-full sm:max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>

          <div className="mt-6 px-4 pb-8 space-y-6">
            {/* Search */}
            <FilterSection label="Search">
              <Input
                placeholder="Name or phone…"
                value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
              />
            </FilterSection>

            {/* Status */}
            <FilterSection label="Status">
              <Select value={filters.status} onValueChange={(v) => setFilter("status", v ?? "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </FilterSection>

            {/* Product */}
            <FilterSection label="Product">
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
            </FilterSection>

            {activeFilterCount > 0 && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
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

      {/* ── Create / Edit Sheet ───────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="!w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{mode === "create" ? "Add Customer" : "Edit Customer"}</SheetTitle>
          </SheetHeader>

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <form onSubmit={form.handleSubmit(onSubmit as any)} className="mt-6 space-y-5 px-4 pb-8">
            <Field label="Name" error={form.formState.errors.name?.message}>
              <Input placeholder="Customer name" {...form.register("name")} />
            </Field>

            <Field
              label="Area"
              error={
                (form.formState.errors as Record<string, { message?: string }>).area_id?.message
              }
            >
              <Select
                value={areaId ? String(areaId) : ""}
                onValueChange={(v) => form.setValue("area_id", Number(v), { shouldValidate: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select area">
                    {selectedAreaName ?? undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Pricing Tier">
              <Select
                value={selectedTierId ? String(selectedTierId) : "none"}
                onValueChange={(v) =>
                  form.setValue("pricing_tier_id", v === "none" ? null : Number(v))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No tier">
                    {selectedTierId ? selectedTierLabel : "No tier"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No tier</SelectItem>
                  {tiers.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}-{t.unit_price}tk-{t.min_qty}
                      {t.product_unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Phone">
              <Input placeholder="+880..." {...form.register("phone")} />
            </Field>

            <Field label="WhatsApp">
              <Input placeholder="+880..." {...form.register("whatsapp")} />
            </Field>

            <Field label="Address">
              <Textarea {...form.register("address")} />
            </Field>

            <Field label="Delivery Frequency">
              <Select
                value={deliveryFrequency}
                onValueChange={(v) =>
                  form.setValue("delivery_frequency", v as "daily" | "alternate" | "weekly")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="alternate">Alternate days</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="flex items-center justify-between">
              <div>
                <Label>Due Allowed</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Can this customer carry an outstanding balance?
                </p>
              </div>
              <Switch
                checked={dueAllowed ?? true}
                onCheckedChange={(v) => form.setValue("due_allowed", v)}
              />
            </div>

            {dueAllowed && (
              <Field label="Max Due (৳)">
                <Input
                  type="number"
                  step="0.01"
                  {...form.register("max_due", { valueAsNumber: true })}
                />
              </Field>
            )}

            <Field label="Customer Type">
              <Select
                value={customerType ?? "none"}
                onValueChange={(v) =>
                  form.setValue(
                    "customer_type",
                    v === "none"
                      ? null
                      : (v as "home" | "confectionery" | "hotel" | "restaurant" | "madrasha")
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type">
                    {customerType
                      ? customerType.charAt(0).toUpperCase() + customerType.slice(1)
                      : "Not specified"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="confectionery">Confectionery</SelectItem>
                  <SelectItem value="hotel">Hotel</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="madrasha">Madrasha</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Notes">
              <Textarea {...form.register("notes")} />
            </Field>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={isActive ?? true}
                onCheckedChange={(v) => form.setValue("is_active", v)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-1/2">
                {form.formState.isSubmitting
                  ? "Saving…"
                  : mode === "create"
                    ? "Create"
                    : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetOpen(false)}
                className="w-1/2"
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Customer Detail Sheet ─────────────────────────────────── */}
      <Sheet
        open={viewingCustomer !== null}
        onOpenChange={(open) => !open && setViewingCustomer(null)}
      >
        <SheetContent className="!w-full sm:!max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{viewingCustomer?.name}</SheetTitle>
          </SheetHeader>
          {viewingCustomer && (
            <div className="mt-6 px-4 pb-8 space-y-6">
              {/* Purchase & Payment History — top */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Purchase &amp; Payment History
                </p>
                {historyLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : customerHistory && customerHistory.length > 0 ? (
                  <div className="space-y-6">
                    {customerHistory.map((product) => (
                      <div key={product.product_id} className="space-y-2">
                        {/* Product header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <p className="text-sm font-semibold">{product.product_name}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{product.total_orders} orders</span>
                            <span>
                              {product.total_qty} {product.product_unit}
                            </span>
                            <span className="text-green-600 font-medium">
                              ৳{product.total_paid.toFixed(0)} paid
                            </span>
                            {product.total_due > 0 && (
                              <span className="text-amber-600 font-medium">
                                ৳{product.total_due.toFixed(0)} due
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Orders table */}
                        <div className="rounded-md border border-border overflow-x-auto text-xs">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-muted/50 text-muted-foreground">
                                <th className="text-left px-3 py-2 font-medium">Date</th>
                                <th className="text-left px-3 py-2 font-medium">Status</th>
                                <th className="text-right px-3 py-2 font-medium">Qty</th>
                                <th className="text-right px-3 py-2 font-medium">Total</th>
                                <th className="text-right px-3 py-2 font-medium">Paid</th>
                                <th className="text-right px-3 py-2 font-medium">Due</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {product.orders.map((order) => (
                                <>
                                  <tr key={order.id} className="hover:bg-muted/30">
                                    <td className="px-3 py-2 whitespace-nowrap">
                                      {formatDate(order.ordered_at)}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={`capitalize px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                          order.status === "delivered"
                                            ? "bg-green-100 text-green-700"
                                            : order.status === "pending"
                                              ? "bg-yellow-100 text-yellow-700"
                                              : order.status === "cancelled"
                                                ? "bg-red-100 text-red-700"
                                                : "bg-muted text-muted-foreground"
                                        }`}
                                      >
                                        {order.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                      {order.quantity}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                      ৳{Number(order.total_amount).toFixed(0)}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-green-600">
                                      ৳{Number(order.paid_amount).toFixed(0)}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-amber-600">
                                      {Number(order.due_amount) > 0
                                        ? `৳${Number(order.due_amount).toFixed(0)}`
                                        : "—"}
                                    </td>
                                  </tr>
                                  {order.payments.length > 0 &&
                                    order.payments.map((pay) => (
                                      <tr
                                        key={`pay-${pay.id}`}
                                        className="bg-muted/20 text-muted-foreground"
                                      >
                                        <td className="pl-6 pr-3 py-1.5 whitespace-nowrap">
                                          ↳ {formatDate(pay.paid_at)}
                                        </td>
                                        <td className="px-3 py-1.5 capitalize text-[10px]">
                                          {pay.payment_method ?? "—"}
                                        </td>
                                        <td colSpan={2} className="px-3 py-1.5 text-[11px]">
                                          {pay.note ?? ""}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums text-green-600 font-medium">
                                          ৳{Number(pay.amount).toFixed(0)}
                                        </td>
                                        <td />
                                      </tr>
                                    ))}
                                </>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No orders yet.</p>
                )}
              </div>

              {/* Customer details — below history */}
              <div className="border-t border-border pt-4 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5">
                  <DetailCell label="Status">
                    <Badge variant={viewingCustomer.is_active ? "default" : "secondary"}>
                      {viewingCustomer.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </DetailCell>
                  <DetailCell label="Type">
                    {viewingCustomer.customer_type ? (
                      <Badge variant="outline" className="capitalize">
                        {viewingCustomer.customer_type}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </DetailCell>
                  <DetailCell label="Area">{viewingCustomer.area_name ?? "—"}</DetailCell>
                  <DetailCell label="Phone">{viewingCustomer.phone ?? "—"}</DetailCell>
                  <DetailCell label="WhatsApp">{viewingCustomer.whatsapp ?? "—"}</DetailCell>
                  <DetailCell label="Last Order">
                    {formatDate(viewingCustomer.last_order_date)}
                  </DetailCell>
                  <DetailCell label="Delivery" className="capitalize">
                    {viewingCustomer.delivery_frequency}
                  </DetailCell>
                  <DetailCell label="Interval">
                    {viewingCustomer.delivery_interval} day(s)
                  </DetailCell>
                  <DetailCell label="Due Allowed">
                    {viewingCustomer.due_allowed ? "Yes" : "No"}
                  </DetailCell>
                  {viewingCustomer.due_allowed && (
                    <DetailCell label="Max Due">
                      ৳{Number(viewingCustomer.max_due).toFixed(0)}
                    </DetailCell>
                  )}
                </div>

                {viewingCustomer.address && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Address</p>
                    <p className="text-sm">{viewingCustomer.address}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5">
                  <DetailCell label="Orders">{viewingCustomer.total_orders}</DetailCell>
                  <DetailCell label="Total Qty">{viewingCustomer.total_quantity}</DetailCell>
                  <DetailCell label="Total Assets">
                    {viewingCustomer.total_assets_sent > 0
                      ? viewingCustomer.total_assets_sent
                      : "—"}
                  </DetailCell>
                  <DetailCell label="Assets to Return">
                    {viewingCustomer.unreturned_assets > 0 ? (
                      <span className="text-destructive font-medium">
                        {viewingCustomer.unreturned_assets}
                      </span>
                    ) : (
                      "—"
                    )}
                  </DetailCell>
                  <DetailCell label="Total Paid">
                    <span className="text-green-600 font-medium">
                      ৳{Number(viewingCustomer.total_paid).toFixed(0)}
                    </span>
                  </DetailCell>
                  <DetailCell label="Total Due">
                    <span
                      className={
                        Number(viewingCustomer.total_due) > 0 ? "text-amber-600 font-medium" : ""
                      }
                    >
                      ৳{Number(viewingCustomer.total_due).toFixed(0)}
                    </span>
                  </DetailCell>
                </div>

                {viewingCustomer.tier_name && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5">
                    <DetailCell label="Tier">{viewingCustomer.tier_name}</DetailCell>
                    <DetailCell label="Unit Price">৳{viewingCustomer.tier_unit_price}</DetailCell>
                    <DetailCell label="Min Qty">
                      {viewingCustomer.tier_min_qty} {viewingCustomer.tier_product_unit}
                    </DetailCell>
                  </div>
                )}

                {viewingCustomer.notes && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Notes
                    </p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {viewingCustomer.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Customer Orders & Payments Sheet ─────────────────────── */}
      <Sheet
        open={paymentCustomer !== null}
        onOpenChange={(open) => !open && setPaymentCustomer(null)}
      >
        <SheetContent className="!w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{paymentCustomer?.name ?? ""}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 px-4 pb-8">
            {paymentListLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
            ) : (
              <Tabs value={customerSheetTab} onValueChange={setCustomerSheetTab}>
                <div className="flex items-center gap-2">
                  <TabsList className="flex-1">
                    <TabsTrigger value="payments" className="flex-1">
                      Payments
                    </TabsTrigger>
                    <TabsTrigger value="orders" className="flex-1">
                      Orders
                    </TabsTrigger>
                  </TabsList>
                  {(deliveredOrders.length > 0 || paymentList.length > 0) && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={exportLedger}
                      title="Download Ledger"
                      className="shrink-0"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Payments Tab */}
                <TabsContent value="payments" className="mt-4">
                  {paymentList.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No payments recorded.
                    </p>
                  ) : (
                    <>
                      <div className="rounded-md border border-border overflow-x-auto text-sm">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Product</TableHead>
                              <TableHead>Method</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paymentList.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell className="whitespace-nowrap text-muted-foreground">
                                  {formatDate(p.paid_at)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {p.product_name}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {p.payment_method ?? "—"}
                                </TableCell>
                                <TableCell className="text-right font-medium text-green-600 tabular-nums">
                                  ৳{Number(p.amount).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="mt-3 flex justify-between items-center px-3 py-2 rounded-md bg-muted/50 text-sm font-semibold">
                        <span>Total</span>
                        <span className="text-green-600 tabular-nums">
                          ৳{paymentList.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* Orders Tab */}
                <TabsContent value="orders" className="mt-4">
                  {deliveredOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No delivered orders.
                    </p>
                  ) : (
                    <>
                      <div className="rounded-md border border-border overflow-x-auto text-sm">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-right">Rate</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {deliveredOrders.map((o) => (
                              <TableRow key={o.id}>
                                <TableCell className="whitespace-nowrap text-muted-foreground">
                                  {formatDate(o.delivered_at)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {o.product_name}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {o.quantity}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  ৳{Number(o.unit_price).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                  ৳{Number(o.total_amount).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {(() => {
                        const totalPurchase = deliveredOrders.reduce(
                          (sum, o) => sum + Number(o.total_amount),
                          0
                        );
                        const totalPaid = deliveredOrders.reduce(
                          (sum, o) => sum + Number(o.paid_amount),
                          0
                        );
                        const totalDue = deliveredOrders.reduce(
                          (sum, o) => sum + Number(o.due_amount),
                          0
                        );
                        return (
                          <>
                            <div className="mt-3 flex justify-between items-center px-3 py-2 rounded-md bg-muted/50 text-sm font-semibold">
                              <span>Total</span>
                              <div className="flex gap-4 tabular-nums">
                                <span>
                                  {deliveredOrders.reduce((sum, o) => sum + Number(o.quantity), 0)}{" "}
                                  qty
                                </span>
                                <span>৳{totalPurchase.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="mt-2 flex justify-between items-center px-3 py-2 rounded-md bg-muted/50 text-sm font-semibold">
                              <span>Due</span>
                              <span
                                className={`tabular-nums ${totalDue > 0 ? "text-destructive" : "text-muted-foreground"}`}
                              >
                                {totalDue > 0 ? `৳${totalDue.toFixed(2)}` : "—"}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground px-3">
                              ৳{totalPurchase.toFixed(2)} purchase − ৳{totalPaid.toFixed(2)} paid
                            </p>
                          </>
                        );
                      })()}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Deactivate Customer"
        description={`Are you sure you want to deactivate "${confirmTarget?.name}"?`}
        confirmLabel="Deactivate"
        loading={confirming}
        onConfirm={handleDeactivateConfirmed}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FilterSection({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function DetailCell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${className ?? ""}`}>{children}</p>
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
