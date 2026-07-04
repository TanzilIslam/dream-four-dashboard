"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  PlusIcon,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Eye,
  Banknote,
} from "lucide-react";

import {
  createPurchaseRequestSchema,
  markPurchasedSchema,
  addSupplierPaymentSchema,
  type CreatePurchaseRequestInput,
  type MarkPurchasedInput,
  type AddSupplierPaymentInput,
} from "@/lib/schemas/purchase-request";
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

type PurchaseRequest = {
  id: number;
  partner_id: number;
  supplier_id: number;
  product_id: number;
  requested_qty: number;
  estimated_price: string | null;
  estimated_total: string | null;
  status: "pending" | "approved" | "rejected" | "purchased";
  admin_note: string | null;
  actual_qty: number | null;
  actual_price: string | null;
  actual_total: string | null;
  purchased_at: string | null;
  note: string | null;
  created_at: string;
  supplier_name: string | null;
  product_name: string | null;
  product_unit: string | null;
  partner_name?: string | null;
  paid_total: string | null;
  due_amount: string | null;
};

type SupplierPayment = {
  id: number;
  purchase_request_id: number;
  amount: string;
  paid_at: string;
  payment_method: string | null;
  from_personal: boolean;
  note: string | null;
  created_by: number | null;
  created_at: string;
  created_by_name: string | null;
};

type Supplier = { id: number; name: string };
type Product = { id: number; name: string; unit: string };
type ProductAsset = { id: number; name: string };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  purchased: "outline",
};

export default function PurchaseRequestsPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");
  const [sortBy, setSortBy] = useState<
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

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PurchaseRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PurchaseRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [approveTarget, setApproveTarget] = useState<PurchaseRequest | null>(null);
  const [approving, setApproving] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [rejectTarget, setRejectTarget] = useState<PurchaseRequest | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [purchaseTarget, setPurchaseTarget] = useState<PurchaseRequest | null>(null);
  const [purchaseTargetAssets, setPurchaseTargetAssets] = useState<ProductAsset[]>([]);
  const [purchaseAssetQtys, setPurchaseAssetQtys] = useState<Record<number, number>>({});
  const [detailsTarget, setDetailsTarget] = useState<PurchaseRequest | null>(null);

  const [paymentTarget, setPaymentTarget] = useState<PurchaseRequest | null>(null);
  const [detailPayments, setDetailPayments] = useState<SupplierPayment[]>([]);
  const [detailPaymentsLoading, setDetailPaymentsLoading] = useState(false);
  const [detailPaymentSummary, setDetailPaymentSummary] = useState<{
    paid_total: number;
    due_amount: number;
    actual_total: number;
  } | null>(null);
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<SupplierPayment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  const createForm = useForm<CreatePurchaseRequestInput>({
    resolver: zodResolver(createPurchaseRequestSchema),
    defaultValues: {
      supplier_id: 0,
      product_id: 0,
      requested_qty: 1,
      estimated_price: null,
      note: "",
    },
  });

  const markPurchasedForm = useForm<MarkPurchasedInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(markPurchasedSchema) as any,
    defaultValues: {
      actual_qty: 1,
      actual_price: 0,
      purchased_at: new Date().toISOString().slice(0, 10),
      admin_note: "",
      initial_payment_amount: 0,
    },
  });

  const paymentForm = useForm<AddSupplierPaymentInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(addSupplierPaymentSchema) as any,
    defaultValues: {
      amount: 0,
      paid_at: new Date().toISOString().slice(0, 10),
      payment_method: "",
      from_personal: false,
      note: "",
    },
  });

  const supplierId = useWatch({
    control: createForm.control,
    name: "supplier_id",
    defaultValue: 0,
  });
  const productId = useWatch({ control: createForm.control, name: "product_id", defaultValue: 0 });
  const selectedSupplierName = suppliers.find((s) => s.id === supplierId)?.name;
  const selectedProductName = products.find((p) => p.id === productId)?.name;

  const markActualQty = useWatch({
    control: markPurchasedForm.control,
    name: "actual_qty",
    defaultValue: 1,
  });
  const markActualPrice = useWatch({
    control: markPurchasedForm.control,
    name: "actual_price",
    defaultValue: 0,
  });
  const markComputedTotal = (Number(markActualQty) || 0) * (Number(markActualPrice) || 0);

  useEffect(() => {
    fetch(`/api/purchase-requests?status=${statusFilter}`)
      .then((res) => res.json())
      .then((data) => {
        setRequests(data);
        setLoading(false);
      });
  }, [statusFilter]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setIsAdmin(data.user?.role === "admin"))
      .catch(() => setIsAdmin(false));
    fetch("/api/settings/suppliers")
      .then((res) => res.json())
      .then((data: Supplier[]) => setSuppliers(data));
    fetch("/api/settings/products")
      .then((res) => res.json())
      .then((data: Product[]) => {
        setProducts(data);
        if (data.length > 0) setProductFilter(String(data[0].id));
      });
  }, []);

  useEffect(() => {
    if (!detailsTarget?.id || detailsTarget.status !== "purchased") {
      return;
    }
    fetch(`/api/purchase-requests/${detailsTarget.id}/payments`)
      .then((res) => res.json())
      .then((data) => {
        setDetailPayments(data.payments ?? []);
        setDetailPaymentSummary({
          paid_total: Number(data.paid_total ?? 0),
          due_amount: Number(data.due_amount ?? 0),
          actual_total: Number(data.actual_total ?? 0),
        });
        setDetailPaymentsLoading(false);
      })
      .catch(() => setDetailPaymentsLoading(false));
  }, [detailsTarget?.id, detailsTarget?.status]);

  useEffect(() => {
    if (!purchaseTarget?.product_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPurchaseTargetAssets([]);
      setPurchaseAssetQtys({});
      return;
    }
    fetch(`/api/products/${purchaseTarget.product_id}/assets`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ProductAsset[]) => {
        setPurchaseTargetAssets(data);
        setPurchaseAssetQtys({});
      })
      .catch(() => {
        setPurchaseTargetAssets([]);
        setPurchaseAssetQtys({});
      });
  }, [purchaseTarget?.product_id]);

  async function refreshRequests() {
    const res = await fetch(`/api/purchase-requests?status=${statusFilter}`);
    setRequests(await res.json());
  }

  async function refreshDetailPayments() {
    if (!detailsTarget) return;
    const res = await fetch(`/api/purchase-requests/${detailsTarget.id}/payments`);
    const data = await res.json();
    setDetailPayments(data.payments ?? []);
    setDetailPaymentSummary({
      paid_total: Number(data.paid_total ?? 0),
      due_amount: Number(data.due_amount ?? 0),
      actual_total: Number(data.actual_total ?? 0),
    });
  }

  function openDetails(r: PurchaseRequest) {
    setDetailPayments([]);
    setDetailPaymentSummary(null);
    setDetailPaymentsLoading(true);
    setDetailsTarget(r);
  }

  function openCreate() {
    createForm.reset({
      supplier_id: 0,
      product_id: 0,
      requested_qty: 1,
      estimated_price: null,
      note: "",
    });
    setEditTarget(null);
    setCreateOpen(true);
  }

  function openEdit(r: PurchaseRequest) {
    createForm.reset({
      supplier_id: r.supplier_id,
      product_id: r.product_id,
      requested_qty: r.requested_qty,
      estimated_price: r.estimated_price ? Number(r.estimated_price) : null,
      note: r.note ?? "",
    });
    setEditTarget(r);
    setCreateOpen(true);
  }

  async function onCreateSubmit(data: CreatePurchaseRequestInput) {
    if (editTarget) {
      const res = await fetch(`/api/purchase-requests/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", ...data }),
      });
      if (res.ok) {
        toast.success("Purchase request updated");
        setCreateOpen(false);
        setEditTarget(null);
        refreshRequests();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to update request");
      }
      return;
    }

    const res = await fetch("/api/purchase-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Purchase request submitted");
      setCreateOpen(false);
      refreshRequests();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to submit request");
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    const res = await fetch(`/api/purchase-requests/${cancelTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Request deleted");
      setCancelTarget(null);
      refreshRequests();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to delete");
    }
    setCancelling(false);
  }

  async function handleApprove() {
    if (!approveTarget) return;
    setApproving(true);
    const res = await fetch(`/api/purchase-requests/${approveTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", admin_note: adminNote }),
    });
    if (res.ok) {
      toast.success("Request approved");
      setApproveTarget(null);
      setAdminNote("");
      refreshRequests();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to approve");
    }
    setApproving(false);
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setRejecting(true);
    const res = await fetch(`/api/purchase-requests/${rejectTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", admin_note: adminNote }),
    });
    if (res.ok) {
      toast.success("Request rejected");
      setRejectTarget(null);
      setAdminNote("");
      refreshRequests();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to reject");
    }
    setRejecting(false);
  }

  async function onMarkPurchased(data: MarkPurchasedInput) {
    if (!purchaseTarget) return;
    const assets = purchaseTargetAssets
      .map((a) => ({ asset_id: a.id, quantity: purchaseAssetQtys[a.id] ?? 0 }))
      .filter((a) => a.quantity > 0);
    const res = await fetch(`/api/purchase-requests/${purchaseTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-purchased", ...data, assets }),
    });
    if (res.ok) {
      toast.success("Marked as purchased");
      setPurchaseTarget(null);
      refreshRequests();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to update");
    }
  }

  async function onAddPayment(data: AddSupplierPaymentInput) {
    if (!paymentTarget) return;
    const res = await fetch(`/api/purchase-requests/${paymentTarget.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Payment recorded");
      setPaymentTarget(null);
      refreshRequests();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to record payment");
    }
  }

  async function handleDeletePayment() {
    if (!deletePaymentTarget || !detailsTarget) return;
    setDeletingPayment(true);
    const res = await fetch(
      `/api/purchase-requests/${detailsTarget.id}/payments/${deletePaymentTarget.id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      toast.success("Payment deleted");
      setDeletePaymentTarget(null);
      refreshDetailPayments();
      refreshRequests();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to delete payment");
    }
    setDeletingPayment(false);
  }

  const filteredRequests = requests
    .filter((r) => {
      if (productFilter !== "all" && String(r.product_id) !== productFilter) return false;
      if (supplierFilter !== "all" && String(r.supplier_id) !== supplierFilter) return false;
      if (dueFilter === "yes" && Number(r.due_amount ?? 0) <= 0) return false;
      if (dueFilter === "no" && Number(r.due_amount ?? 0) > 0) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "id_asc":
          return a.id - b.id;
        case "qty_desc":
          return Number(b.actual_qty ?? b.requested_qty) - Number(a.actual_qty ?? a.requested_qty);
        case "qty_asc":
          return Number(a.actual_qty ?? a.requested_qty) - Number(b.actual_qty ?? b.requested_qty);
        case "total_desc":
          return Number(b.actual_total ?? 0) - Number(a.actual_total ?? 0);
        case "total_asc":
          return Number(a.actual_total ?? 0) - Number(b.actual_total ?? 0);
        case "paid_desc":
          return Number(b.paid_total ?? 0) - Number(a.paid_total ?? 0);
        case "paid_asc":
          return Number(a.paid_total ?? 0) - Number(b.paid_total ?? 0);
        case "due_desc":
          return Number(b.due_amount ?? 0) - Number(a.due_amount ?? 0);
        case "due_asc":
          return Number(a.due_amount ?? 0) - Number(b.due_amount ?? 0);
        default:
          return b.id - a.id;
      }
    });

  const summary = filteredRequests.reduce(
    (acc, r) => {
      acc.qty += Number(r.actual_qty ?? r.requested_qty);
      acc.total += Number(r.actual_total ?? 0);
      acc.paid += Number(r.paid_total ?? 0);
      acc.due += Number(r.due_amount ?? 0);
      return acc;
    },
    { qty: 0, total: 0, paid: 0, due: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div>
          <h1 className="text-xl font-semibold">Purchase Requests</h1>
          <p className="text-sm text-muted-foreground">Request stock purchases from admin.</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openCreate}>
            <PlusIcon className="size-4" />
            New Request
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => setProductFilter(String(p.id))}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              productFilter === String(p.id)
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {!loading && filteredRequests.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap text-sm px-1">
          <span className="text-muted-foreground">
            Qty: <span className="font-medium text-foreground">{summary.qty}</span>
          </span>
          <span className="text-muted-foreground">
            Total: <span className="font-medium text-foreground">৳{summary.total.toFixed(2)}</span>
          </span>
          <span className="text-muted-foreground">
            Paid: <span className="font-medium text-green-600">৳{summary.paid.toFixed(2)}</span>
          </span>
          <span className="text-muted-foreground">
            Due: <span className="font-medium text-amber-600">৳{summary.due.toFixed(2)}</span>
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => v != null && setStatusFilter(v)}>
          <SelectTrigger className="h-8 text-sm w-36">
            <SelectValue>
              {
                {
                  all: "All statuses",
                  pending: "Pending",
                  approved: "Approved",
                  rejected: "Rejected",
                  purchased: "Purchased",
                }[statusFilter]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="purchased">Purchased</SelectItem>
          </SelectContent>
        </Select>

        <Select value={supplierFilter} onValueChange={(v) => setSupplierFilter(v ?? "all")}>
          <SelectTrigger className="h-8 text-sm w-36">
            <SelectValue>
              {supplierFilter === "all"
                ? "All suppliers"
                : (suppliers.find((s) => String(s.id) === supplierFilter)?.name ?? "All suppliers")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dueFilter} onValueChange={(v) => setDueFilter(v ?? "all")}>
          <SelectTrigger className="h-8 text-sm w-32">
            <SelectValue>{{ all: "All due", yes: "Has due", no: "No due" }[dueFilter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All due</SelectItem>
            <SelectItem value="yes">Has due</SelectItem>
            <SelectItem value="no">No due</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="h-8 text-sm w-44">
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
                }[sortBy]
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
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              {isAdmin && <TableHead>Partner</TableHead>}
              <TableHead>Product</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Est. Price</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[180px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 13 : 12}
                  className="text-center text-muted-foreground py-10"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 13 : 12}
                  className="text-center text-muted-foreground py-10"
                >
                  No requests
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground text-xs">#{r.id}</TableCell>
                  {isAdmin && <TableCell>{r.partner_name ?? "—"}</TableCell>}
                  <TableCell className="font-medium">
                    {r.product_name ?? "—"}
                    {r.product_unit && (
                      <span className="text-muted-foreground text-xs ml-1">({r.product_unit})</span>
                    )}
                  </TableCell>
                  <TableCell>{r.supplier_name ?? "—"}</TableCell>
                  <TableCell>{r.requested_qty}</TableCell>
                  <TableCell>
                    {r.estimated_price ? `৳${Number(r.estimated_price).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.actual_total ? `৳${Number(r.actual_total).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-green-600">
                    {Number(r.paid_total) > 0 ? `৳${Number(r.paid_total).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-amber-600">
                    {Number(r.due_amount) > 0 ? `৳${Number(r.due_amount).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                    {r.admin_note ?? r.note ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(r)}
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCancelTarget(r)}
                          className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                      {isAdmin && r.status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setAdminNote("");
                              setApproveTarget(r);
                            }}
                            className="size-7 text-green-600 hover:bg-green-50 hover:text-green-700"
                            title="Approve"
                          >
                            <CheckCircle2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setAdminNote("");
                              setRejectTarget(r);
                            }}
                            className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Reject"
                          >
                            <XCircle className="size-3.5" />
                          </Button>
                        </>
                      )}
                      {isAdmin && r.status === "approved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            markPurchasedForm.reset({
                              actual_qty: r.requested_qty,
                              actual_price: r.estimated_price ? Number(r.estimated_price) : 0,
                              purchased_at: new Date().toISOString().slice(0, 10),
                              admin_note: "",
                              initial_payment_amount: 0,
                            });
                            setPurchaseTarget(r);
                          }}
                          className="size-7 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          title="Mark as purchased"
                        >
                          <ShoppingBag className="size-3.5" />
                        </Button>
                      )}
                      {isAdmin && r.status === "purchased" && Number(r.due_amount) > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            paymentForm.reset({
                              amount: Number(r.due_amount),
                              paid_at: new Date().toISOString().slice(0, 10),
                              payment_method: "",
                              from_personal: false,
                              note: "",
                            });
                            setPaymentTarget(r);
                          }}
                          className="size-7 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                          title="Add payment"
                        >
                          <Banknote className="size-3.5" />
                        </Button>
                      )}
                      {r.status === "purchased" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDetails(r)}
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title="View details"
                        >
                          <Eye className="size-3.5" />
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

      {/* Create / Edit sheet */}
      <Sheet
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditTarget(null);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editTarget ? "Edit Purchase Request" : "New Purchase Request"}</SheetTitle>
          </SheetHeader>
          <form
            onSubmit={createForm.handleSubmit(onCreateSubmit)}
            className="mt-6 space-y-5 px-4 pb-8"
          >
            <Field
              label="Supplier"
              error={
                (createForm.formState.errors as Record<string, { message?: string }>).supplier_id
                  ?.message
              }
            >
              <Select
                value={supplierId ? String(supplierId) : ""}
                onValueChange={(v) =>
                  createForm.setValue("supplier_id", Number(v), { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select supplier">
                    {selectedSupplierName ?? undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
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

            <Field label="Requested Qty" error={createForm.formState.errors.requested_qty?.message}>
              <Input
                type="number"
                min={1}
                {...createForm.register("requested_qty", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Estimated Price per Unit (৳)">
              <Input
                type="number"
                step="0.01"
                placeholder="Optional"
                {...createForm.register("estimated_price", {
                  setValueAs: (v) => (v === "" || v === undefined ? null : Number(v)),
                })}
              />
            </Field>

            <Field label="Note">
              <Textarea placeholder="Any additional info…" {...createForm.register("note")} />
            </Field>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={createForm.formState.isSubmitting} className="w-1/2">
                {createForm.formState.isSubmitting
                  ? editTarget
                    ? "Saving…"
                    : "Submitting…"
                  : editTarget
                    ? "Save Changes"
                    : "Submit Request"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setEditTarget(null);
                }}
                className="w-1/2"
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Mark as purchased sheet */}
      <Sheet
        open={purchaseTarget !== null}
        onOpenChange={(open) => !open && setPurchaseTarget(null)}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Mark as Purchased</SheetTitle>
          </SheetHeader>
          <form
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onSubmit={markPurchasedForm.handleSubmit(onMarkPurchased as any)}
            className="mt-6 space-y-5 px-4 pb-8"
          >
            <Field
              label="Actual Qty"
              error={markPurchasedForm.formState.errors.actual_qty?.message}
            >
              <Input
                type="number"
                min={1}
                {...markPurchasedForm.register("actual_qty", { valueAsNumber: true })}
              />
            </Field>

            <Field
              label="Actual Price per Unit (৳)"
              error={markPurchasedForm.formState.errors.actual_price?.message}
            >
              <Input
                type="number"
                step="0.01"
                {...markPurchasedForm.register("actual_price", { valueAsNumber: true })}
              />
            </Field>

            {markComputedTotal > 0 && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-semibold">৳{markComputedTotal.toFixed(2)}</span>
              </div>
            )}

            <Field
              label="Purchase Date"
              error={markPurchasedForm.formState.errors.purchased_at?.message}
            >
              <Input type="date" {...markPurchasedForm.register("purchased_at")} />
            </Field>

            <Field label="Admin Note">
              <Textarea {...markPurchasedForm.register("admin_note")} />
            </Field>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Initial Payment (Optional)
              </p>
              <Field
                label="Amount Paid Now (৳)"
                error={
                  (markPurchasedForm.formState.errors as Record<string, { message?: string }>)
                    .initial_payment_amount?.message
                }
              >
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="0"
                  {...markPurchasedForm.register("initial_payment_amount", { valueAsNumber: true })}
                />
              </Field>
            </div>

            {purchaseTargetAssets.length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Assets Received (Optional)
                </p>
                <div className="space-y-3">
                  {purchaseTargetAssets.map((a) => (
                    <Field key={a.id} label={a.name}>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={purchaseAssetQtys[a.id] ?? ""}
                        onChange={(e) =>
                          setPurchaseAssetQtys((prev) => ({
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
              <Button
                type="submit"
                disabled={markPurchasedForm.formState.isSubmitting}
                className="w-1/2"
              >
                {markPurchasedForm.formState.isSubmitting ? "Saving…" : "Confirm"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPurchaseTarget(null)}
                className="w-1/2"
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Add Payment sheet */}
      <Sheet
        open={paymentTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPaymentTarget(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add Payment</SheetTitle>
          </SheetHeader>
          {paymentTarget && (
            <div className="mt-4 px-4">
              <p className="text-sm text-muted-foreground">
                {paymentTarget.product_name} — Due:{" "}
                <span className="font-semibold text-amber-600">
                  ৳{Number(paymentTarget.due_amount).toFixed(2)}
                </span>
              </p>
            </div>
          )}
          <form
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onSubmit={paymentForm.handleSubmit(onAddPayment as any)}
            className="mt-4 space-y-5 px-4 pb-8"
          >
            <Field
              label="Amount (৳)"
              error={
                (paymentForm.formState.errors as Record<string, { message?: string }>).amount
                  ?.message
              }
            >
              <Input
                type="number"
                step="0.01"
                min={0.01}
                {...paymentForm.register("amount", { valueAsNumber: true })}
              />
            </Field>

            <Field
              label="Payment Date"
              error={
                (paymentForm.formState.errors as Record<string, { message?: string }>).paid_at
                  ?.message
              }
            >
              <Input type="date" {...paymentForm.register("paid_at")} />
            </Field>

            <Field label="Payment Method">
              <Input placeholder="Cash, bKash…" {...paymentForm.register("payment_method")} />
            </Field>

            <div className="flex items-center justify-between">
              <div>
                <Label>From Personal Funds</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Paid from own pocket</p>
              </div>
              <input
                type="checkbox"
                className="size-4"
                {...paymentForm.register("from_personal")}
              />
            </div>

            <Field label="Note">
              <Textarea placeholder="Optional note…" {...paymentForm.register("note")} />
            </Field>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={paymentForm.formState.isSubmitting} className="w-1/2">
                {paymentForm.formState.isSubmitting ? "Recording…" : "Record Payment"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentTarget(null)}
                className="w-1/2"
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete request confirm */}
      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Delete Request"
        description={`Permanently delete the purchase request for "${cancelTarget?.product_name}"?`}
        confirmLabel="Delete"
        loading={cancelling}
        onConfirm={handleCancel}
      />

      {/* Approve confirm */}
      <ConfirmDialog
        open={approveTarget !== null}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve Request"
        description={`Approve the purchase request for "${approveTarget?.product_name}" (${approveTarget?.requested_qty} ${approveTarget?.product_unit ?? "units"})?`}
        confirmLabel="Approve"
        loading={approving}
        onConfirm={handleApprove}
      />

      {/* Reject confirm */}
      <ConfirmDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Reject Request"
        description={`Reject the purchase request for "${rejectTarget?.product_name}"?`}
        confirmLabel="Reject"
        loading={rejecting}
        onConfirm={handleReject}
      />

      {/* Delete payment confirm */}
      <ConfirmDialog
        open={deletePaymentTarget !== null}
        onOpenChange={(open) => !open && setDeletePaymentTarget(null)}
        title="Delete Payment"
        description={`Delete payment of ৳${Number(deletePaymentTarget?.amount ?? 0).toFixed(2)} on ${
          deletePaymentTarget?.paid_at
            ? new Date(deletePaymentTarget.paid_at).toLocaleDateString()
            : "—"
        }?`}
        confirmLabel="Delete"
        loading={deletingPayment}
        onConfirm={handleDeletePayment}
      />

      {/* Purchase details sidebar */}
      <Sheet open={detailsTarget !== null} onOpenChange={(open) => !open && setDetailsTarget(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Purchase Details</SheetTitle>
          </SheetHeader>
          {detailsTarget && (
            <div className="mt-6 px-4 pb-8 space-y-6">
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Request
                </h3>
                <dl className="space-y-2">
                  {isAdmin && detailsTarget.partner_name && (
                    <DetailRow label="Partner" value={detailsTarget.partner_name} />
                  )}
                  <DetailRow
                    label="Product"
                    value={`${detailsTarget.product_name ?? "—"} ${detailsTarget.product_unit ? `(${detailsTarget.product_unit})` : ""}`}
                  />
                  <DetailRow label="Supplier" value={detailsTarget.supplier_name ?? "—"} />
                  <DetailRow label="Requested Qty" value={String(detailsTarget.requested_qty)} />
                  <DetailRow
                    label="Est. Price / Unit"
                    value={
                      detailsTarget.estimated_price
                        ? `৳${Number(detailsTarget.estimated_price).toFixed(2)}`
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Est. Total"
                    value={
                      detailsTarget.estimated_total
                        ? `৳${Number(detailsTarget.estimated_total).toFixed(2)}`
                        : "—"
                    }
                  />
                  {detailsTarget.note && <DetailRow label="Note" value={detailsTarget.note} />}
                  <DetailRow
                    label="Submitted"
                    value={new Date(detailsTarget.created_at).toLocaleDateString()}
                  />
                </dl>
              </section>

              <div className="border-t border-border" />

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Purchase
                </h3>
                <dl className="space-y-2">
                  <DetailRow label="Actual Qty" value={String(detailsTarget.actual_qty ?? "—")} />
                  <DetailRow
                    label="Actual Price / Unit"
                    value={
                      detailsTarget.actual_price
                        ? `৳${Number(detailsTarget.actual_price).toFixed(2)}`
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Actual Total"
                    value={
                      detailsTarget.actual_total
                        ? `৳${Number(detailsTarget.actual_total).toFixed(2)}`
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Purchase Date"
                    value={
                      detailsTarget.purchased_at
                        ? new Date(detailsTarget.purchased_at).toLocaleDateString()
                        : "—"
                    }
                  />
                  {detailsTarget.admin_note && (
                    <DetailRow label="Admin Note" value={detailsTarget.admin_note} />
                  )}
                </dl>
              </section>

              <div className="border-t border-border" />

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Supplier Payments
                </h3>
                {detailPaymentsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : detailPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {detailPayments.map((p) => (
                      <div key={p.id} className="flex items-start justify-between gap-2">
                        <div className="text-sm">
                          <p className="font-medium">৳{Number(p.amount).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(p.paid_at).toLocaleDateString()}
                            {p.payment_method && ` · ${p.payment_method}`}
                            {p.from_personal && " · Personal"}
                          </p>
                          {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                        </div>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                            onClick={() => setDeletePaymentTarget(p)}
                            title="Delete payment"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {detailPaymentSummary && (
                  <div className="rounded-md bg-muted px-3 py-2 text-sm space-y-1 mt-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold tabular-nums">
                        ৳{detailPaymentSummary.actual_total.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid</span>
                      <span className="font-semibold tabular-nums text-green-600">
                        ৳{detailPaymentSummary.paid_total.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Due</span>
                      <span
                        className={`font-semibold tabular-nums ${
                          detailPaymentSummary.due_amount > 0 ? "text-amber-600" : "text-green-600"
                        }`}
                      >
                        ৳{detailPaymentSummary.due_amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-sm text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-right">{value}</dd>
    </div>
  );
}
