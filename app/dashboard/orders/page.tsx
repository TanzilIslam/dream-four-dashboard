"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import {
  PlusIcon,
  Truck,
  BanknoteIcon,
  XCircle,
  ChevronsUpDown,
  Check,
  SlidersHorizontal,
  X,
  Trash2,
  Loader2,
  Undo2,
  Eye,
  Pencil,
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
  customer_phone: string | null;
  area_name: string | null;
  product_name: string | null;
  product_unit: string | null;
  partner_name?: string | null;
  unreturned_assets: number;
  last_payment_date: string | null;
  unit: string | null;
  unit_cost: string;
  unit_transport_cost: string;
  unit_label_cost: string;
  unit_other_cost: string;
  collection: string;
  total_cost: string;
  net_value: string;
  due_collection: number;
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
};

type OrderPayment = {
  id: number;
  order_id: number;
  partner_id: number;
  customer_id: number;
  amount: string;
  payment_method: string | null;
  paid_at: string;
  note: string | null;
  recorded_by_name: string | null;
};

type OrderPaymentSummary = {
  paid_total: number;
  due_amount: number;
  total_amount: number;
};

type ProductAsset = { id: number; name: string };
type OrderAssetSent = { id: number; asset_id: number; quantity: number; asset_name: string };
type OrderAssetReturn = {
  id: number;
  asset_id: number;
  quantity: number;
  returned_at: string;
  asset_name: string;
  created_by_name: string | null;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  delivered: "default",
  paid: "outline",
  cancelled: "destructive",
};

const UNIT_OPTIONS = ["piece", "dozen", "box", "kg", "liter", "pack", "bag", "crate", "tray"];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [_tiers, setTiers] = useState<Tier[]>([]);
  const [_stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [orderSummary, setOrderSummary] = useState({ total: 0, paid: 0, due: 0 });
  const [filterOpen, setFilterOpen] = useState(false);
  const [orderSort, setOrderSort] = useState<
    | "none"
    | "id_desc"
    | "id_asc"
    | "qty_desc"
    | "qty_asc"
    | "total_desc"
    | "total_asc"
    | "paid_desc"
    | "paid_asc"
    | "due_desc"
    | "due_asc"
  >("id_desc");
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  const [filters, setFilters] = useState({
    status: "all",
    product_id: "all",
    area_id: "all",
    customer_search: "",
    partner_name: "all",
  });

  const [paidDateFilter, setPaidDateFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [paymentSheetTarget, setPaymentSheetTarget] = useState<Order | null>(null);
  const [orderPayments, setOrderPayments] = useState<OrderPayment[]>([]);
  const [orderPaymentsLoading, setOrderPaymentsLoading] = useState(false);
  const [orderPaymentSummary, setOrderPaymentSummary] = useState<OrderPaymentSummary | null>(null);
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<OrderPayment | null>(null);
  const [deletingOrderPayment, setDeletingOrderPayment] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [deliverTarget, setDeliverTarget] = useState<Order | null>(null);
  const [delivering, setDelivering] = useState(false);

  // Assets for create/edit order form
  const [formOrderAssets, setFormOrderAssets] = useState<ProductAsset[]>([]);
  const [formOrderAssetQtys, setFormOrderAssetQtys] = useState<Record<number, number>>({});

  // Assets for payment sheet (asset returns from customer)
  const [orderAssetsSent, setOrderAssetsSent] = useState<OrderAssetSent[]>([]);
  const [orderAssetsReturned, setOrderAssetsReturned] = useState<OrderAssetReturn[]>([]);
  const [payAssetReturnQtys, setPayAssetReturnQtys] = useState<Record<number, number>>({});
  const [payAssetReturnDate, setPayAssetReturnDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Standalone asset return sheet
  const [returnAssetTarget, setReturnAssetTarget] = useState<Order | null>(null);
  const [returnAssetSent, setReturnAssetSent] = useState<OrderAssetSent[]>([]);
  const [returnAssetReturned, setReturnAssetReturned] = useState<OrderAssetReturn[]>([]);
  const [returnAssetQtys, setReturnAssetQtys] = useState<Record<number, number>>({});
  const [returnAssetDate, setReturnAssetDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnAssetSubmitting, setReturnAssetSubmitting] = useState(false);

  // Order detail view
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [_viewOrderPayments, setViewOrderPayments] = useState<OrderPayment[]>([]);
  const [_viewOrderLoading, setViewOrderLoading] = useState(false);

  const createForm = useForm<z.input<typeof createOrderSchema>, unknown, CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customer_id: 0,
      product_id: 0,
      quantity: 1,
      unit: "",
      unit_price: 0,
      unit_cost: 0,
      unit_transport_cost: 0,
      unit_label_cost: 0,
      unit_other_cost: 0,
      paid_amount: 0,
      ordered_at: new Date().toISOString().slice(0, 10),
      note: "",
    },
  });

  const payForm = useForm<z.input<typeof payOrderSchema>, unknown, PayOrderInput>({
    resolver: zodResolver(payOrderSchema),
    defaultValues: {
      paid_amount: 0,
      payment_method: "",
      paid_at: new Date().toISOString().slice(0, 10),
      note: "",
      asset_returns: [],
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
  const watchUnitCost = useWatch({
    control: createForm.control,
    name: "unit_cost",
    defaultValue: 0,
  });
  const watchUnitTransportCost = useWatch({
    control: createForm.control,
    name: "unit_transport_cost",
    defaultValue: 0,
  });
  const watchUnitLabelCost = useWatch({
    control: createForm.control,
    name: "unit_label_cost",
    defaultValue: 0,
  });
  const watchUnitOtherCost = useWatch({
    control: createForm.control,
    name: "unit_other_cost",
    defaultValue: 0,
  });
  const watchUnit = useWatch({
    control: createForm.control,
    name: "unit",
    defaultValue: "",
  });

  const orderSales = (watchQuantity || 0) * (watchUnitPrice || 0);
  const orderCollection = watchPaidAmount || 0;
  const orderDue = Math.max(0, orderSales - orderCollection);
  const orderTotalCost =
    ((watchUnitCost || 0) +
      (watchUnitTransportCost || 0) +
      (watchUnitLabelCost || 0) +
      (watchUnitOtherCost || 0)) *
    (watchQuantity || 0);
  const orderNetValue = orderSales - orderTotalCost;
  const selectedProductName = products.find((p) => p.id === productId)?.name;

  // Auto-calculate sales price (unit_price) = unit_cost + label_cost + other_cost (only for new orders)
  useEffect(() => {
    if (formMode === "edit") return;
    const salesPrice =
      (watchUnitCost || 0) +
      (watchUnitTransportCost || 0) +
      (watchUnitLabelCost || 0) +
      (watchUnitOtherCost || 0);
    createForm.setValue("unit_price", salesPrice);
  }, [
    watchUnitCost,
    watchUnitTransportCost,
    watchUnitLabelCost,
    watchUnitOtherCost,
    createForm,
    formMode,
  ]);

  // Auto-fill unit from product
  useEffect(() => {
    if (!productId) return;
    const product = products.find((p) => p.id === productId);
    if (product) {
      createForm.setValue("unit", product.unit);
    }
  }, [productId, products, createForm]);

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
    fetch(`/api/orders/summary?product_id=${filters.product_id}`)
      .then((res) => res.json())
      .then((data) => setOrderSummary(data));
  }, [filters.product_id]);

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
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!paymentSheetTarget) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderPaymentsLoading(true);
    setOrderPayments([]);
    setOrderPaymentSummary(null);
    fetch(`/api/orders/${paymentSheetTarget.id}/payments`)
      .then((res) => res.json())
      .then((data) => {
        setOrderPayments(data.payments ?? []);
        setOrderPaymentSummary({
          paid_total: Number(data.paid_total ?? 0),
          due_amount: Number(data.due_amount ?? 0),
          total_amount: Number(data.total_amount ?? 0),
        });
        setOrderPaymentsLoading(false);
      })
      .catch(() => setOrderPaymentsLoading(false));
  }, [paymentSheetTarget]);

  useEffect(() => {
    if (!productId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormOrderAssets([]);
      setFormOrderAssetQtys({});
      return;
    }
    fetch(`/api/products/${productId}/assets`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ProductAsset[]) => {
        setFormOrderAssets(data);
        setFormOrderAssetQtys({});
      })
      .catch(() => {
        setFormOrderAssets([]);
        setFormOrderAssetQtys({});
      });
  }, [productId]);

  useEffect(() => {
    if (!paymentSheetTarget) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrderAssetsSent([]);
      setOrderAssetsReturned([]);
      setPayAssetReturnQtys({});
      return;
    }
    fetch(`/api/orders/${paymentSheetTarget.id}/asset-returns`)
      .then((res) => (res.ok ? res.json() : { sent: [], returned: [] }))
      .then((data: { sent: OrderAssetSent[]; returned: OrderAssetReturn[] }) => {
        setOrderAssetsSent(data.sent ?? []);
        setOrderAssetsReturned(data.returned ?? []);
        setPayAssetReturnQtys({});
      })
      .catch(() => {
        setOrderAssetsSent([]);
        setOrderAssetsReturned([]);
        setPayAssetReturnQtys({});
      });
  }, [paymentSheetTarget]);

  useEffect(() => {
    if (!viewingOrder) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewOrderLoading(true);
    setViewOrderPayments([]);
    fetch(`/api/orders/${viewingOrder.id}/payments`)
      .then((r) => r.json())
      .then((data) => setViewOrderPayments(data.payments ?? []))
      .finally(() => setViewOrderLoading(false));
  }, [viewingOrder]);

  async function refreshOrders() {
    const [ordersRes, stockRes, summaryRes] = await Promise.all([
      fetch(`/api/orders?status=${apiStatus}`),
      fetch("/api/stock"),
      fetch(`/api/orders/summary?product_id=${filters.product_id}`),
    ]);
    setOrders(await ordersRes.json());
    setStock(await stockRes.json());
    setOrderSummary(await summaryRes.json());
  }

  function setFilter<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters({
      status: "all",
      product_id: "all",
      area_id: "all",
      customer_search: "",
      partner_name: "all",
    });
    setPaidDateFilter("");
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
    filters.product_id !== "all",
    filters.area_id !== "all",
    !!paidDateFilter,
    filters.customer_search !== "",
    filters.partner_name !== "all",
  ].filter(Boolean).length;

  const filteredOrders = orders
    .filter((o) => {
      if (filters.status === "due" && Number(o.due_amount) <= 0) return false;
      if (filters.product_id !== "all" && String(o.product_id) !== filters.product_id) return false;
      if (filters.area_id !== "all" && String(o.area_id) !== filters.area_id) return false;
      if (
        filters.customer_search &&
        !(o.customer_name ?? "").toLowerCase().includes(filters.customer_search.toLowerCase())
      )
        return false;
      if (filters.partner_name !== "all" && o.partner_name !== filters.partner_name) return false;
      if (paidDateFilter) {
        if (!o.last_payment_date) return false;
        const lpd = new Date(o.last_payment_date).toISOString().slice(0, 10);
        if (lpd !== paidDateFilter) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (orderSort) {
        case "id_desc":
          return b.id - a.id;
        case "id_asc":
          return a.id - b.id;
        case "qty_desc":
          return b.quantity - a.quantity;
        case "qty_asc":
          return a.quantity - b.quantity;
        case "total_desc":
          return Number(b.total_amount) - Number(a.total_amount);
        case "total_asc":
          return Number(a.total_amount) - Number(b.total_amount);
        case "paid_desc":
          return Number(b.paid_amount) - Number(a.paid_amount);
        case "paid_asc":
          return Number(a.paid_amount) - Number(b.paid_amount);
        case "due_desc":
          return Number(b.due_amount) - Number(a.due_amount);
        case "due_asc":
          return Number(a.due_amount) - Number(b.due_amount);
        default:
          return b.id - a.id;
      }
    });

  const hasUnreturnedAssets = filteredOrders.some((o) => o.unreturned_assets > 0);

  function openCreate() {
    setFormMode("create");
    setEditingId(null);
    createForm.reset({
      customer_id: 0,
      product_id: 0,
      quantity: 1,
      unit: "",
      unit_price: 0,
      unit_cost: 0,
      unit_transport_cost: 0,
      unit_label_cost: 0,
      unit_other_cost: 0,
      paid_amount: 0,
      ordered_at: new Date().toISOString().slice(0, 10),
      note: "",
    });
    setFormOrderAssets([]);
    setFormOrderAssetQtys({});
    setFormOpen(true);
  }

  function openViewOrder(order: Order) {
    setPaymentSheetTarget(null);
    setViewingOrder(order);
  }

  function openPaymentSheet(order: Order) {
    payForm.reset({
      paid_amount: Number(order.due_amount),
      payment_method: "",
      paid_at: new Date().toISOString().slice(0, 10),
      note: "",
    });
    setViewingOrder(null);
    setPaymentSheetTarget(order);
  }

  function openEdit(order: Order) {
    setFormMode("edit");
    setEditingId(order.id);
    createForm.reset({
      customer_id: order.customer_id,
      product_id: order.product_id,
      quantity: order.quantity,
      unit: order.unit || "",
      unit_price: Number(order.unit_price),
      unit_cost: Number(order.unit_cost),
      unit_transport_cost: Number(order.unit_transport_cost),
      unit_label_cost: Number(order.unit_label_cost),
      unit_other_cost: Number(order.unit_other_cost),
      paid_amount: Number(order.paid_amount),
      ordered_at: new Date(order.ordered_at).toISOString().slice(0, 10),
      note: order.note || "",
    });
    // Load assets for edit
    fetch(`/api/orders/${order.id}/asset-returns`)
      .then((r) => (r.ok ? r.json() : { sent: [], returned: [] }))
      .then((data: { sent: OrderAssetSent[] }) => {
        const qtys: Record<number, number> = {};
        for (const s of data.sent ?? []) {
          qtys[s.asset_id] = s.quantity;
        }
        setFormOrderAssetQtys(qtys);
      })
      .catch(() => {});
    setFormOpen(true);
  }

  async function onFormSubmit(data: CreateOrderInput) {
    const assets = formOrderAssets
      .map((a) => ({ asset_id: a.id, quantity: formOrderAssetQtys[a.id] ?? 0 }))
      .filter((a) => a.quantity > 0);

    if (formMode === "edit" && editingId) {
      const { customer_id: _cid, paid_amount: _pa, ...editData } = data;
      void _cid;
      void _pa;
      const res = await fetch(`/api/orders/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", ...editData, assets }),
      });
      if (res.ok) {
        toast.success("Order updated");
        setFormOpen(false);
        refreshOrders();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to update order");
      }
    } else {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, assets }),
      });
      if (res.ok) {
        toast.success("Order created");
        setFormOpen(false);
        refreshOrders();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to create order");
      }
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

  async function reloadPaymentSheet(orderId: number) {
    const [paymentsData, ordersData, stockData] = await Promise.all([
      fetch(`/api/orders/${orderId}/payments`).then((r) => r.json()),
      fetch(`/api/orders?status=${apiStatus}`).then((r) => r.json()),
      fetch("/api/stock").then((r) => r.json()),
    ]);
    setOrderPayments(paymentsData.payments ?? []);
    setOrderPaymentSummary({
      paid_total: Number(paymentsData.paid_total ?? 0),
      due_amount: Number(paymentsData.due_amount ?? 0),
      total_amount: Number(paymentsData.total_amount ?? 0),
    });
    setOrders(ordersData);
    setStock(stockData);
  }

  async function onPaySubmit(data: PayOrderInput) {
    if (!paymentSheetTarget) return;
    const asset_returns = orderAssetsSent
      .map((s) => ({
        asset_id: s.asset_id,
        quantity: payAssetReturnQtys[s.asset_id] ?? 0,
        returned_at: payAssetReturnDate,
      }))
      .filter((ar) => ar.quantity > 0);
    const res = await fetch(`/api/orders/${paymentSheetTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pay", ...data, asset_returns }),
    });
    if (res.ok) {
      const updatedOrder: Order = await res.json();
      toast.success("Payment recorded");
      setPaymentSheetTarget(updatedOrder);
      setPayAssetReturnQtys({});
      payForm.reset({
        paid_amount: Number(updatedOrder.due_amount) > 0 ? Number(updatedOrder.due_amount) : 0,
        payment_method: "",
        paid_at: new Date().toISOString().slice(0, 10),
        note: "",
      });
      await reloadPaymentSheet(paymentSheetTarget.id);
      // Refresh asset returns data
      fetch(`/api/orders/${paymentSheetTarget.id}/asset-returns`)
        .then((r) => (r.ok ? r.json() : { sent: [], returned: [] }))
        .then((d: { sent: OrderAssetSent[]; returned: OrderAssetReturn[] }) => {
          setOrderAssetsSent(d.sent ?? []);
          setOrderAssetsReturned(d.returned ?? []);
        })
        .catch(() => {});
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to record payment");
    }
  }

  function openReturnAssetSheet(order: Order) {
    setReturnAssetTarget(order);
    setReturnAssetQtys({});
    setReturnAssetDate(new Date().toISOString().slice(0, 10));
    fetch(`/api/orders/${order.id}/asset-returns`)
      .then((r) => r.json())
      .then((d: { sent: OrderAssetSent[]; returned: OrderAssetReturn[] }) => {
        setReturnAssetSent(d.sent ?? []);
        setReturnAssetReturned(d.returned ?? []);
      });
  }

  async function handleReturnAssetSubmit() {
    if (!returnAssetTarget) return;
    const returns = returnAssetSent
      .map((s) => ({
        asset_id: s.asset_id,
        quantity: returnAssetQtys[s.asset_id] ?? 0,
        returned_at: returnAssetDate,
      }))
      .filter((r) => r.quantity > 0);
    if (returns.length === 0) {
      toast.error("Enter at least one quantity");
      return;
    }
    setReturnAssetSubmitting(true);
    const res = await fetch(`/api/orders/${returnAssetTarget.id}/asset-returns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returns }),
    });
    if (res.ok) {
      toast.success("Asset return recorded");
      // Refresh
      fetch(`/api/orders/${returnAssetTarget.id}/asset-returns`)
        .then((r) => r.json())
        .then((d: { sent: OrderAssetSent[]; returned: OrderAssetReturn[] }) => {
          setReturnAssetSent(d.sent ?? []);
          setReturnAssetReturned(d.returned ?? []);
        });
      setReturnAssetQtys({});
      // Refresh orders list
      fetch(`/api/orders?status=${apiStatus}`)
        .then((r) => r.json())
        .then(setOrders);
    } else {
      toast.error("Failed to record return");
    }
    setReturnAssetSubmitting(false);
  }

  async function handleDeleteOrderPayment() {
    if (!deletePaymentTarget || !paymentSheetTarget) return;
    setDeletingOrderPayment(true);
    const res = await fetch(
      `/api/orders/${paymentSheetTarget.id}/payments/${deletePaymentTarget.id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      toast.success("Payment deleted");
      setDeletePaymentTarget(null);
      const [paymentsData, ordersData, stockData] = await Promise.all([
        fetch(`/api/orders/${paymentSheetTarget.id}/payments`).then((r) => r.json()),
        fetch(`/api/orders?status=${apiStatus}`).then((r) => r.json()),
        fetch("/api/stock").then((r) => r.json()),
      ]);
      setOrderPayments(paymentsData.payments ?? []);
      setOrderPaymentSummary({
        paid_total: Number(paymentsData.paid_total ?? 0),
        due_amount: Number(paymentsData.due_amount ?? 0),
        total_amount: Number(paymentsData.total_amount ?? 0),
      });
      setOrders(ordersData);
      setStock(stockData);
      const newDue = Number(paymentsData.due_amount ?? 0);
      const newStatus =
        newDue > 0 && paymentSheetTarget.status === "paid"
          ? paymentSheetTarget.delivered_at
            ? "delivered"
            : "pending"
          : paymentSheetTarget.status;
      setPaymentSheetTarget((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          paid_amount: String(paymentsData.paid_total ?? 0),
          due_amount: String(newDue),
          status: newStatus as Order["status"],
        };
      });
      if (newDue > 0) {
        payForm.reset({
          paid_amount: newDue,
          payment_method: "",
          paid_at: new Date().toISOString().slice(0, 10),
          note: "",
        });
      }
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error((err as { error?: string }).error ?? "Failed to delete payment");
    }
    setDeletingOrderPayment(false);
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

  // Shared action buttons used in both table and card views
  function OrderActions({ o, fullWidth }: { o: Order; fullWidth?: boolean }) {
    return (
      <div
        className={
          fullWidth
            ? "flex items-center justify-around border-t border-border pt-2 -mx-1"
            : "flex items-center gap-1"
        }
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openViewOrder(o)}
          className="size-7 text-muted-foreground hover:text-foreground"
          title="View order details"
        >
          <Eye className="size-3.5" />
        </Button>
        {(o.status === "pending" || o.status === "delivered") && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(o)}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Edit order"
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
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
        {(o.status === "pending" || o.status === "delivered" || Number(o.paid_amount) > 0) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openPaymentSheet(o)}
            className="size-7 text-green-600 hover:bg-green-50 hover:text-green-700"
            title="Payments"
          >
            <BanknoteIcon className="size-3.5" />
          </Button>
        )}
        {o.unreturned_assets > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openReturnAssetSheet(o)}
            className="size-7 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
            title={`Return assets (${o.unreturned_assets} unreturned)`}
          >
            <Undo2 className="size-3.5" />
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
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div>
          <h1 className="text-xl font-semibold hidden sm:block">Orders</h1>
          {/* <p className="text-sm text-muted-foreground">
            Track deliveries and payments.
            {!loading && (
              <span className="ml-1 font-medium text-foreground">
                {filteredOrders.length}
                {filteredOrders.length !== orders.length ? ` of ${orders.length}` : ""} total
              </span>
            )}
          </p> */}
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* <div className="relative w-full sm:w-auto">
            <Input
              type="date"
              value={paidDateFilter}
              onChange={(e) => setPaidDateFilter(e.target.value)}
              className="h-8 text-sm w-full sm:w-38 pr-7"
              title="Filter by paid date"
            />
            {paidDateFilter && (
              <button
                onClick={() => setPaidDateFilter("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
          <Select value={orderSort} onValueChange={(v) => setOrderSort(v as typeof orderSort)}>
            <SelectTrigger className="h-8 text-sm w-full sm:w-44">
              <SelectValue>
                {
                  {
                    id_desc: "Newest first",
                    id_asc: "Oldest first",
                    qty_desc: "Qty: high to low",
                    qty_asc: "Qty: low to high",
                    total_desc: "Total: high to low",
                    total_asc: "Total: low to high",
                    paid_desc: "Paid: high to low",
                    paid_asc: "Paid: low to high",
                    due_desc: "Due: high to low",
                    due_asc: "Due: low to high",
                    none: "No sort",
                  }[orderSort]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="id_desc">Newest first</SelectItem>
              <SelectItem value="id_asc">Oldest first</SelectItem>
              <SelectItem value="qty_desc">Qty: high to low</SelectItem>
              <SelectItem value="qty_asc">Qty: low to high</SelectItem>
              <SelectItem value="total_desc">Total: high to low</SelectItem>
              <SelectItem value="total_asc">Total: low to high</SelectItem>
              <SelectItem value="paid_desc">Paid: high to low</SelectItem>
              <SelectItem value="paid_asc">Paid: low to high</SelectItem>
              <SelectItem value="due_desc">Due: high to low</SelectItem>
              <SelectItem value="due_asc">Due: low to high</SelectItem>
            </SelectContent>
          </Select> */}
          {/* <Button
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
          </Button> */}
          <Button size="sm" onClick={openCreate}>
            <PlusIcon className="size-4" />
            <span className="hidden sm:inline">New Order</span>
          </Button>
        </div>
      </div>

      {/* Stock summary — filtered by selected product */}
      {/* {!loading && stock.length > 0 && (
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
                  </span>
                  {low && <span className="text-xs font-medium">Low stock</span>}
                </div>
              );
            })}
        </div>
      )} */}

      {/* Inline filter bar */}
      <div className="grid grid-cols-12 items-start gap-4">
        <OrderFilterSection label="Customer" className="col-span-12 sm:col-span-6">
          <Input
            placeholder="Search customer…"
            value={filters.customer_search}
            onChange={(e) => setFilter("customer_search", e.target.value)}
          />
        </OrderFilterSection>
        <OrderFilterSection label="Status" className="col-span-6 sm:col-span-3">
          <Select value={filters.status} onValueChange={(v) => setFilter("status", v ?? "all")}>
            <SelectTrigger className="w-full overflow-hidden">
              <SelectValue className="truncate">
                {{
                  all: "All Active",
                  due: "Due",
                  pending: "Pending",
                  delivered: "Delivered",
                  paid: "Paid",
                  cancelled: "Cancelled",
                }[filters.status] ?? filters.status}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Active</SelectItem>
              <SelectItem value="due">Due</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </OrderFilterSection>
        <OrderFilterSection label="Product" className="col-span-6 sm:col-span-3">
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
      </div>
      {/* {!loading && orders.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap text-sm px-1">
          <span className="text-muted-foreground">
            Total:{" "}
            <span className="font-medium text-foreground">৳{orderSummary.total.toFixed(2)}</span>
          </span>
          <span className="text-muted-foreground">
            Paid:{" "}
            <span className="font-medium text-green-600">৳{orderSummary.paid.toFixed(2)}</span>
          </span>
          <span className="text-muted-foreground">
            Due: <span className="font-medium text-amber-600">৳{orderSummary.due.toFixed(2)}</span>
          </span>
        </div>
      )} */}

      {/* ── Desktop: Table | Mobile: Cards ── */}
      {loading ? (
        <div className="text-center text-muted-foreground py-10">Loading…</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center text-muted-foreground py-10">
          {activeFilterCount > 0 ? "No orders match your filters" : "No orders"}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Status</TableHead>
                  {hasUnreturnedAssets && <TableHead>Assets</TableHead>}
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.customer_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{o.product_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      <div>{formatDate(o.ordered_at)}</div>
                      {o.delivered_at && (
                        <div className="text-green-600">{formatDate(o.delivered_at)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm space-y-0.5">
                      <div>
                        <span className="text-muted-foreground">Qty:</span> {o.quantity}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rate:</span> ৳
                        {Number(o.unit_price).toFixed(2)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sales:</span> ৳
                        {Number(o.total_amount).toFixed(2)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Due:</span>{" "}
                        {Number(o.due_amount) > 0 ? (
                          <span className="text-destructive">
                            ৳{Number(o.due_amount).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[o.status] ?? "secondary"}>{o.status}</Badge>
                    </TableCell>
                    {hasUnreturnedAssets && (
                      <TableCell>
                        {o.unreturned_assets > 0 ? (
                          <span className="font-medium text-amber-600">{o.unreturned_assets}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <OrderActions o={o} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map((o) => (
              <div key={o.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                {/* Top row: customer · product · status */}
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="font-medium truncate">{o.customer_name ?? "—"}</span>
                  <span className="text-sm text-muted-foreground truncate text-center">
                    {o.product_name ?? "—"}
                  </span>
                  <span className="text-right">
                    <Badge variant={STATUS_VARIANT[o.status] ?? "secondary"}>{o.status}</Badge>
                  </span>
                </div>

                {/* Details row */}
                <div className="flex items-center justify-around text-sm text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Qty</p>
                    <p className="font-medium">{o.quantity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rate</p>
                    <p className="font-medium">৳{Number(o.unit_price).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sales</p>
                    <p className="font-medium">৳{Number(o.total_amount).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due</p>
                    <p
                      className={
                        Number(o.due_amount) > 0
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {Number(o.due_amount) > 0 ? `৳${Number(o.due_amount).toFixed(2)}` : "—"}
                    </p>
                  </div>
                  {hasUnreturnedAssets && o.unreturned_assets > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Assets</p>
                      <p className="font-medium text-amber-600">{o.unreturned_assets}</p>
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className="text-xs text-muted-foreground">
                  <span>{formatDate(o.ordered_at)}</span>
                  {o.delivered_at && (
                    <span className="text-green-600 ml-2">→ {formatDate(o.delivered_at)}</span>
                  )}
                </div>

                {/* Actions */}
                <OrderActions o={o} fullWidth />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Filter sheet (mobile only) */}
      <Sheet open={filterOpen && isMobile} onOpenChange={(open) => !open && setFilterOpen(false)}>
        <SheetContent className="!w-full sm:max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-6 px-4 pb-8 space-y-6">
            {/* Status */}
            <OrderFilterSection label="Status">
              <Select value={filters.status} onValueChange={(v) => setFilter("status", v ?? "all")}>
                <SelectTrigger className="w-full overflow-hidden">
                  <SelectValue className="truncate">
                    {{
                      all: "All Active",
                      due: "Due",
                      pending: "Pending",
                      delivered: "Delivered",
                      paid: "Paid",
                      cancelled: "Cancelled",
                    }[filters.status] ?? filters.status}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due">Due</SelectItem>
                  <SelectItem value="all">All Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
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

      {/* Create / Edit order sheet */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="!w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{formMode === "edit" ? "Edit Order" : "New Order"}</SheetTitle>
          </SheetHeader>
          <form
            onSubmit={createForm.handleSubmit(onFormSubmit)}
            className="mt-6 space-y-5 px-4 pb-8"
          >
            <Field label="Date" error={createForm.formState.errors.ordered_at?.message}>
              <Input type="date" {...createForm.register("ordered_at")} />
            </Field>

            <Field
              label="Customer"
              error={
                (createForm.formState.errors as Record<string, { message?: string }>).customer_id
                  ?.message
              }
            >
              {formMode === "edit" ? (
                <Input
                  value={customers.find((c) => c.id === customerId)?.name ?? ""}
                  disabled
                  className="bg-muted"
                />
              ) : (
                <CustomerSearch
                  customers={customers}
                  value={customerId}
                  onChange={(id) =>
                    createForm.setValue("customer_id", id, { shouldValidate: true })
                  }
                />
              )}
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

            <Field label="Unit">
              <Select
                value={String(watchUnit ?? "")}
                onValueChange={(v) => createForm.setValue("unit", v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
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

            <Field label="Unit Cost (৳)" error={createForm.formState.errors.unit_cost?.message}>
              <Input
                type="number"
                step="0.01"
                min={0}
                {...createForm.register("unit_cost", { valueAsNumber: true })}
              />
            </Field>

            <Field
              label="Transport Cost per Unit (৳)"
              error={createForm.formState.errors.unit_transport_cost?.message}
            >
              <Input
                type="number"
                step="0.01"
                min={0}
                {...createForm.register("unit_transport_cost", { valueAsNumber: true })}
              />
            </Field>

            <Field
              label="Label Cost per Unit (৳)"
              error={createForm.formState.errors.unit_label_cost?.message}
            >
              <Input
                type="number"
                step="0.01"
                min={0}
                {...createForm.register("unit_label_cost", { valueAsNumber: true })}
              />
            </Field>

            <Field
              label="Other Cost per Unit (৳)"
              error={createForm.formState.errors.unit_other_cost?.message}
            >
              <Input
                type="number"
                step="0.01"
                min={0}
                {...createForm.register("unit_other_cost", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Sales Price (৳)" error={createForm.formState.errors.unit_price?.message}>
              <Input
                type="number"
                step="0.01"
                min={0}
                {...createForm.register("unit_price", { valueAsNumber: true })}
              />
            </Field>

            {formMode !== "edit" && (
              <Field
                label="Paid Now / Collection (৳)"
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
            )}

            {orderSales > 0 && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sales</span>
                  <span>৳{orderSales.toFixed(2)}</span>
                </div>
                {formMode !== "edit" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due</span>
                    <span className={orderDue > 0 ? "text-destructive" : "text-green-600"}>
                      ৳{orderDue.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Cost</span>
                  <span>৳{orderTotalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Net Value</span>
                  <span className={orderNetValue < 0 ? "text-destructive" : "text-green-600"}>
                    ৳{orderNetValue.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <Field label="Note">
              <Textarea placeholder="Optional note…" {...createForm.register("note")} />
            </Field>

            {formOrderAssets.length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Assets Sent to Customer (Optional)
                </p>
                <div className="space-y-3">
                  {formOrderAssets.map((a) => (
                    <Field key={a.id} label={a.name}>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={formOrderAssetQtys[a.id] ?? ""}
                        onChange={(e) =>
                          setFormOrderAssetQtys((prev) => ({
                            ...prev,
                            [a.id]: Number(e.target.value),
                          }))
                        }
                      />
                    </Field>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={createForm.formState.isSubmitting} className="w-1/2">
                {createForm.formState.isSubmitting
                  ? formMode === "edit"
                    ? "Saving…"
                    : "Creating…"
                  : formMode === "edit"
                    ? "Save Changes"
                    : "Create Order"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                className="w-1/2"
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Payment sheet — history + record */}
      <Sheet
        open={paymentSheetTarget !== null}
        onOpenChange={(open) => !open && setPaymentSheetTarget(null)}
      >
        <SheetContent className="!w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Payments — {paymentSheetTarget?.customer_name ?? "Order"}</SheetTitle>
          </SheetHeader>

          {/* Summary bar */}
          {orderPaymentSummary && (
            <div className="mx-4 mt-3 rounded-md bg-muted/50 px-3 py-2 text-sm grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-medium tabular-nums">
                  ৳{orderPaymentSummary.total_amount.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="font-medium text-green-600 tabular-nums">
                  ৳{orderPaymentSummary.paid_total.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due</p>
                <p
                  className={`font-medium tabular-nums ${orderPaymentSummary.due_amount > 0 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  ৳{orderPaymentSummary.due_amount.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Payment history */}
          <div className="px-4 mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Payment History
            </p>
            {orderPaymentsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : orderPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No payments recorded yet
              </p>
            ) : (
              <div className="space-y-2">
                {orderPayments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-medium tabular-nums">৳{Number(p.amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.paid_at)}
                        {p.payment_method ? ` · ${p.payment_method}` : ""}
                      </p>
                      {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                      {p.recorded_by_name && (
                        <p className="text-xs text-muted-foreground">by {p.recorded_by_name}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:bg-destructive/10 shrink-0 ml-2"
                      onClick={() => setDeletePaymentTarget(p)}
                      title="Delete payment"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add payment form — only when order can still accept payments */}
          {paymentSheetTarget &&
            (paymentSheetTarget.status === "pending" ||
              paymentSheetTarget.status === "delivered") && (
              <>
                <div className="mx-4 mt-5 border-t border-border" />
                <div className="px-4 mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Record Payment
                  </p>
                  <form onSubmit={payForm.handleSubmit(onPaySubmit)} className="space-y-4 pb-8">
                    <Field label="Amount (৳)" error={payForm.formState.errors.paid_amount?.message}>
                      <Input
                        type="number"
                        step="0.01"
                        {...payForm.register("paid_amount", { valueAsNumber: true })}
                      />
                    </Field>
                    <Field label="Payment Method">
                      <Input
                        placeholder="Cash, bKash, bank…"
                        {...payForm.register("payment_method")}
                      />
                    </Field>
                    <Field label="Paid At">
                      <Input type="date" {...payForm.register("paid_at")} />
                    </Field>
                    <Field label="Note">
                      <Textarea {...payForm.register("note")} />
                    </Field>

                    {orderAssetsSent.length > 0 && (
                      <div className="border-t border-border pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                          Assets Returned by Customer (Optional)
                        </p>
                        {orderAssetsReturned.length > 0 && (
                          <div className="mb-3 space-y-1">
                            {orderAssetsReturned.map((r) => (
                              <p key={r.id} className="text-xs text-muted-foreground">
                                {r.asset_name}: {r.quantity} returned on {formatDate(r.returned_at)}
                              </p>
                            ))}
                          </div>
                        )}
                        <div className="space-y-3 mb-3">
                          {orderAssetsSent.map((s) => (
                            <Field key={s.asset_id} label={`${s.asset_name} (sent: ${s.quantity})`}>
                              <Input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={payAssetReturnQtys[s.asset_id] ?? ""}
                                onChange={(e) =>
                                  setPayAssetReturnQtys((prev) => ({
                                    ...prev,
                                    [s.asset_id]: Number(e.target.value),
                                  }))
                                }
                              />
                            </Field>
                          ))}
                        </div>
                        {Object.values(payAssetReturnQtys).some((q) => q > 0) && (
                          <Field label="Return Date">
                            <Input
                              type="date"
                              value={payAssetReturnDate}
                              onChange={(e) => setPayAssetReturnDate(e.target.value)}
                            />
                          </Field>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        type="submit"
                        disabled={payForm.formState.isSubmitting}
                        className="w-1/2"
                      >
                        {payForm.formState.isSubmitting ? "Saving…" : "Record Payment"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPaymentSheetTarget(null)}
                        className="w-1/2"
                      >
                        Close
                      </Button>
                    </div>
                  </form>
                </div>
              </>
            )}

          {/* Close button for paid orders with no form */}
          {paymentSheetTarget &&
            paymentSheetTarget.status !== "pending" &&
            paymentSheetTarget.status !== "delivered" && (
              <div className="px-4 mt-5 pb-8">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setPaymentSheetTarget(null)}
                >
                  Close
                </Button>
              </div>
            )}
        </SheetContent>
      </Sheet>

      {/* Delete payment confirm */}
      <ConfirmDialog
        open={deletePaymentTarget !== null}
        onOpenChange={(open) => !open && setDeletePaymentTarget(null)}
        title="Delete Payment"
        description={`Delete payment of ৳${deletePaymentTarget ? Number(deletePaymentTarget.amount).toFixed(2) : ""}? This will update the order balance.`}
        confirmLabel="Delete Payment"
        loading={deletingOrderPayment}
        onConfirm={handleDeleteOrderPayment}
      />

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
        <SheetContent className="!w-full sm:max-w-md">
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

      {/* Standalone Asset Return Sheet */}
      <Sheet
        open={returnAssetTarget !== null}
        onOpenChange={(open) => !open && setReturnAssetTarget(null)}
      >
        <SheetContent className="!w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Return Assets — Order #{returnAssetTarget?.id}</SheetTitle>
          </SheetHeader>
          {returnAssetTarget && (
            <div className="mt-6 px-4 pb-8 space-y-5">
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>
                  <span className="font-medium text-foreground">
                    {returnAssetTarget.customer_name}
                  </span>
                </p>
                <p>{formatDate(returnAssetTarget.ordered_at)}</p>
              </div>

              {/* Already returned */}
              {returnAssetReturned.length > 0 && (
                <div className="rounded-md border border-border p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Already Returned
                  </p>
                  {returnAssetReturned.map((r) => (
                    <p key={r.id} className="text-xs text-muted-foreground">
                      {r.asset_name}:{" "}
                      <span className="font-medium text-foreground">{r.quantity}</span> on{" "}
                      {formatDate(r.returned_at)}
                    </p>
                  ))}
                </div>
              )}

              {/* Return inputs */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Record Return
                </p>
                {returnAssetSent.map((s) => {
                  const alreadyReturned = returnAssetReturned
                    .filter((r) => r.asset_id === s.asset_id)
                    .reduce((sum, r) => sum + r.quantity, 0);
                  const remaining = s.quantity - alreadyReturned;
                  return (
                    <Field
                      key={s.asset_id}
                      label={`${s.asset_name} (sent: ${s.quantity}, returned: ${alreadyReturned}, remaining: ${remaining})`}
                    >
                      <Input
                        type="number"
                        min={0}
                        max={remaining}
                        placeholder="0"
                        value={returnAssetQtys[s.asset_id] ?? ""}
                        onChange={(e) =>
                          setReturnAssetQtys((prev) => ({
                            ...prev,
                            [s.asset_id]: Number(e.target.value),
                          }))
                        }
                      />
                    </Field>
                  );
                })}
                {returnAssetSent.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No assets were sent with this order.
                  </p>
                )}
              </div>

              {returnAssetSent.length > 0 && (
                <Field label="Return Date">
                  <Input
                    type="date"
                    value={returnAssetDate}
                    onChange={(e) => setReturnAssetDate(e.target.value)}
                  />
                </Field>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleReturnAssetSubmit}
                  disabled={returnAssetSubmitting || returnAssetSent.length === 0}
                  className="w-1/2"
                >
                  {returnAssetSubmitting ? "Saving…" : "Record Return"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setReturnAssetTarget(null)}
                  className="w-1/2"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Order Detail Sheet */}
      <Sheet open={viewingOrder !== null} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <SheetContent className="!w-full sm:!max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Order #{viewingOrder?.id}</SheetTitle>
          </SheetHeader>
          {viewingOrder && (
            <div className="mt-4 px-4 pb-8 space-y-6">
              {/* Order info */}
              <div className="rounded-lg border border-border p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{viewingOrder.customer_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Product</p>
                  <p className="font-medium">{viewingOrder.product_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Order Date</p>
                  <p>{formatDate(viewingOrder.ordered_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={STATUS_VARIANT[viewingOrder.status] ?? "secondary"}>
                    {viewingOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Unit</p>
                  <p>{viewingOrder.unit || viewingOrder.product_unit || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Quantity</p>
                  <p>{viewingOrder.quantity}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Unit Cost</p>
                  <p>৳{Number(viewingOrder.unit_cost).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Transport Cost</p>
                  <p>৳{Number(viewingOrder.unit_transport_cost).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Unit Price</p>
                  <p>৳{Number(viewingOrder.unit_price).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sales</p>
                  <p className="font-semibold">৳{Number(viewingOrder.total_amount).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Collection</p>
                  <p className="text-green-600 font-medium">
                    ৳{Number(viewingOrder.collection).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due</p>
                  <p
                    className={
                      Number(viewingOrder.due_amount) > 0
                        ? "text-destructive font-medium"
                        : "text-muted-foreground"
                    }
                  >
                    ৳{Number(viewingOrder.due_amount).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due Collection</p>
                  <p className="text-green-600">
                    ৳{Number(viewingOrder.due_collection ?? 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Label Cost</p>
                  <p>৳{Number(viewingOrder.unit_label_cost).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Other Cost</p>
                  <p>৳{Number(viewingOrder.unit_other_cost).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Cost</p>
                  <p>৳{Number(viewingOrder.total_cost).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net Value</p>
                  <p
                    className={
                      Number(viewingOrder.net_value) < 0
                        ? "text-destructive font-medium"
                        : "font-medium"
                    }
                  >
                    ৳{Number(viewingOrder.net_value).toFixed(2)}
                  </p>
                </div>
                {viewingOrder.area_name && (
                  <div>
                    <p className="text-xs text-muted-foreground">Area</p>
                    <p>{viewingOrder.area_name}</p>
                  </div>
                )}
                {viewingOrder.delivered_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Delivered</p>
                    <p>{formatDate(viewingOrder.delivered_at)}</p>
                  </div>
                )}
                {viewingOrder.note && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Note</p>
                    <p className="text-sm">{viewingOrder.note}</p>
                  </div>
                )}
                {viewingOrder.cancellation_reason && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Cancellation Reason</p>
                    <p className="text-sm text-destructive">{viewingOrder.cancellation_reason}</p>
                  </div>
                )}
              </div>

              {/* Payment history — hidden, use money icon instead */}
            </div>
          )}
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

function OrderFilterSection({
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
