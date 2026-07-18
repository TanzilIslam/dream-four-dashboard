"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { PlusIcon, Pencil, Trash2, Eye, Banknote } from "lucide-react";

import {
  createPurchaseSchema,
  addSupplierPaymentSchema,
  type CreatePurchaseInput,
  type AddSupplierPaymentInput,
} from "@/lib/schemas/purchase-request";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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

const UNIT_OPTIONS = ["piece", "dozen", "box", "kg", "liter", "pack", "bag", "crate", "tray"];

type Purchase = {
  id: number;
  partner_id: number;
  supplier_id: number;
  product_id: number;
  actual_qty: number | null;
  actual_price: string | null;
  actual_total: string | null;
  unit: string | null;
  unit_transport_cost: string | null;
  unit_label_cost: string | null;
  unit_other_cost: string | null;
  purchased_at: string | null;
  payment_method: string | null;
  from_personal: boolean;
  note: string | null;
  remarks: string | null;
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

type PurchaseAsset = { asset_id: number; quantity: number; asset_name: string };
type Supplier = { id: number; name: string };
type Product = { id: number; name: string; unit: string };
type ProductAsset = { id: number; name: string };

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
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
  >("id_asc");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Purchase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Assets state for create/edit form
  const [formAssets, setFormAssets] = useState<ProductAsset[]>([]);
  const [formAssetQtys, setFormAssetQtys] = useState<Record<number, number>>({});

  // Payment states
  const [paymentTarget, setPaymentTarget] = useState<Purchase | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Purchase | null>(null);
  const [detailAssets, setDetailAssets] = useState<PurchaseAsset[]>([]);
  const [detailPayments, setDetailPayments] = useState<SupplierPayment[]>([]);
  const [detailPaymentsLoading, setDetailPaymentsLoading] = useState(false);
  const [detailPaymentSummary, setDetailPaymentSummary] = useState<{
    paid_total: number;
    due_amount: number;
    actual_total: number;
  } | null>(null);
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<SupplierPayment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  const purchaseForm = useForm<CreatePurchaseInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createPurchaseSchema) as any,
    defaultValues: {
      supplier_id: 0,
      product_id: 0,
      actual_qty: 1,
      actual_price: 0,
      unit: "",
      unit_transport_cost: 0,
      unit_label_cost: 0,
      unit_other_cost: 0,
      purchased_at: new Date().toISOString().slice(0, 10),
      payment_method: "",
      from_personal: false,
      note: "",
      remarks: "",
      assets: [],
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

  // Watched values for live computed display
  const watchQty = useWatch({ control: purchaseForm.control, name: "actual_qty", defaultValue: 1 });
  const watchPrice = useWatch({
    control: purchaseForm.control,
    name: "actual_price",
    defaultValue: 0,
  });
  const watchTransport = useWatch({
    control: purchaseForm.control,
    name: "unit_transport_cost",
    defaultValue: 0,
  });
  const watchLabel = useWatch({
    control: purchaseForm.control,
    name: "unit_label_cost",
    defaultValue: 0,
  });
  const watchOther = useWatch({
    control: purchaseForm.control,
    name: "unit_other_cost",
    defaultValue: 0,
  });

  const watchProductId = useWatch({
    control: purchaseForm.control,
    name: "product_id",
    defaultValue: 0,
  });
  const watchSupplierId = useWatch({
    control: purchaseForm.control,
    name: "supplier_id",
    defaultValue: 0,
  });
  const watchUnit = useWatch({
    control: purchaseForm.control,
    name: "unit",
    defaultValue: "",
  });

  const computedUnitCost =
    (Number(watchPrice) || 0) +
    (Number(watchTransport) || 0) +
    (Number(watchLabel) || 0) +
    (Number(watchOther) || 0);
  const computedTotal = computedUnitCost * (Number(watchQty) || 0);

  const selectedSupplierName = suppliers.find((s) => s.id === watchSupplierId)?.name;
  const selectedProductName = products.find((p) => p.id === watchProductId)?.name;

  // Fetch purchases
  useEffect(() => {
    fetch("/api/purchase-requests")
      .then((res) => res.json())
      .then((data) => {
        setPurchases(data);
        setLoading(false);
      });
  }, []);

  // Fetch suppliers & products
  useEffect(() => {
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

  // Fetch assets when product changes in form
  useEffect(() => {
    if (!watchProductId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormAssets([]);
      setFormAssetQtys({});
      return;
    }
    fetch(`/api/products/${watchProductId}/assets`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ProductAsset[]) => {
        setFormAssets(data);
        if (!editTarget) setFormAssetQtys({});
      })
      .catch(() => {
        setFormAssets([]);
        setFormAssetQtys({});
      });
  }, [watchProductId, editTarget]);

  // Fetch payment details and assets
  useEffect(() => {
    if (!detailsTarget?.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetailPaymentsLoading(true);
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
    fetch(`/api/purchase-requests/${detailsTarget.id}/assets`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDetailAssets(data))
      .catch(() => setDetailAssets([]));
  }, [detailsTarget?.id]);

  async function refreshPurchases() {
    const res = await fetch("/api/purchase-requests");
    setPurchases(await res.json());
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

  function openCreate() {
    purchaseForm.reset({
      supplier_id: 0,
      product_id: 0,
      actual_qty: 1,
      actual_price: 0,
      unit: "",
      unit_transport_cost: 0,
      unit_label_cost: 0,
      unit_other_cost: 0,
      purchased_at: new Date().toISOString().slice(0, 10),
      payment_method: "",
      from_personal: false,
      note: "",
      remarks: "",
      assets: [],
    });
    setFormAssetQtys({});
    setEditTarget(null);
    setCreateOpen(true);
  }

  function openEdit(r: Purchase) {
    purchaseForm.reset({
      supplier_id: r.supplier_id,
      product_id: r.product_id,
      actual_qty: r.actual_qty ?? 1,
      actual_price: r.actual_price ? Number(r.actual_price) : 0,
      unit: r.unit ?? "",
      unit_transport_cost: r.unit_transport_cost ? Number(r.unit_transport_cost) : 0,
      unit_label_cost: r.unit_label_cost ? Number(r.unit_label_cost) : 0,
      unit_other_cost: r.unit_other_cost ? Number(r.unit_other_cost) : 0,
      purchased_at: r.purchased_at
        ? r.purchased_at.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      payment_method: r.payment_method ?? "",
      from_personal: r.from_personal,
      note: r.note ?? "",
      remarks: r.remarks ?? "",
      assets: [],
    });
    setFormAssetQtys({});
    setEditTarget(r);
    setCreateOpen(true);

    // Load existing assets for this purchase
    fetch(`/api/purchase-requests/${r.id}/assets`)
      .then((res) => (res.ok ? res.json() : []))
      .then((assets: { asset_id: number; quantity: number }[]) => {
        const qtys: Record<number, number> = {};
        for (const a of assets) qtys[a.asset_id] = a.quantity;
        setFormAssetQtys(qtys);
      })
      .catch(() => {});
  }

  async function onSubmit(data: CreatePurchaseInput) {
    const assets = formAssets
      .map((a) => ({ asset_id: a.id, quantity: formAssetQtys[a.id] ?? 0 }))
      .filter((a) => a.quantity > 0);

    const payload = { ...data, assets };

    if (editTarget) {
      const res = await fetch(`/api/purchase-requests/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("Purchase updated");
        setCreateOpen(false);
        setEditTarget(null);
        refreshPurchases();
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to update");
      }
      return;
    }

    const res = await fetch("/api/purchase-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success("Purchase created");
      setCreateOpen(false);
      refreshPurchases();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to create");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/purchase-requests/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Purchase deleted");
      setDeleteTarget(null);
      refreshPurchases();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to delete");
    }
    setDeleting(false);
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
      refreshPurchases();
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
      refreshPurchases();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to delete payment");
    }
    setDeletingPayment(false);
  }

  const filteredPurchases = purchases
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
          return new Date(a.purchased_at ?? 0).getTime() - new Date(b.purchased_at ?? 0).getTime();
        case "qty_desc":
          return Number(b.actual_qty ?? 0) - Number(a.actual_qty ?? 0);
        case "qty_asc":
          return Number(a.actual_qty ?? 0) - Number(b.actual_qty ?? 0);
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
          return new Date(b.purchased_at ?? 0).getTime() - new Date(a.purchased_at ?? 0).getTime();
      }
    });

  const summary = filteredPurchases.reduce(
    (acc, r) => {
      acc.qty += Number(r.actual_qty ?? 0);
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
          <h1 className="text-xl font-semibold">Purchases</h1>
          <p className="text-sm text-muted-foreground">Manage stock purchases.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="size-4" />
          New Purchase
        </Button>
      </div>

      {/* Product pill filter */}
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

      {/* Summary bar */}
      {!loading && filteredPurchases.length > 0 && (
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

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
        <Select value={supplierFilter} onValueChange={(v) => setSupplierFilter(v ?? "all")}>
          <SelectTrigger className="h-8 text-sm w-full sm:w-36">
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
          <SelectTrigger className="h-8 text-sm w-full sm:w-32">
            <SelectValue>{{ all: "All due", yes: "Has due", no: "No due" }[dueFilter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All due</SelectItem>
            <SelectItem value="yes">Has due</SelectItem>
            <SelectItem value="no">No due</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
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

      {/* Table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-35" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filteredPurchases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                  No purchases
                </TableCell>
              </TableRow>
            ) : (
              filteredPurchases.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground text-xs">#{r.id}</TableCell>
                  <TableCell className="font-medium">
                    {r.product_name ?? "—"}
                    {r.product_unit && (
                      <span className="text-muted-foreground text-xs ml-1">({r.product_unit})</span>
                    )}
                  </TableCell>
                  <TableCell>{r.supplier_name ?? "—"}</TableCell>
                  <TableCell>{r.actual_qty ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.actual_price ? `৳${Number(r.actual_price).toFixed(2)}` : "—"}
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
                  <TableCell className="text-sm text-muted-foreground max-w-40 truncate">
                    {r.note ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(r.purchased_at ?? r.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(r)}
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(r)}
                        className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                      {Number(r.due_amount) > 0 && (
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDetailPayments([]);
                          setDetailAssets([]);
                          setDetailPaymentSummary(null);
                          setDetailPaymentsLoading(true);
                          setDetailsTarget(r);
                        }}
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="View details"
                      >
                        <Eye className="size-3.5" />
                      </Button>
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
        <SheetContent className="!w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editTarget ? "Edit Purchase" : "New Purchase"}</SheetTitle>
          </SheetHeader>
          <form
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onSubmit={purchaseForm.handleSubmit(onSubmit as any)}
            className="mt-6 space-y-5 px-4 pb-8"
          >
            <Field
              label="Purchase Date"
              error={purchaseForm.formState.errors.purchased_at?.message}
            >
              <Input type="date" {...purchaseForm.register("purchased_at")} />
            </Field>

            <Field
              label="Supplier"
              error={
                (purchaseForm.formState.errors as Record<string, { message?: string }>).supplier_id
                  ?.message
              }
            >
              <Select
                value={watchSupplierId ? String(watchSupplierId) : ""}
                onValueChange={(v) =>
                  purchaseForm.setValue("supplier_id", Number(v), { shouldValidate: true })
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
                (purchaseForm.formState.errors as Record<string, { message?: string }>).product_id
                  ?.message
              }
            >
              <Select
                value={watchProductId ? String(watchProductId) : ""}
                onValueChange={(v) =>
                  purchaseForm.setValue("product_id", Number(v), { shouldValidate: true })
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
                onValueChange={(v) => purchaseForm.setValue("unit", v ?? "")}
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

            <Field label="Quantity" error={purchaseForm.formState.errors.actual_qty?.message}>
              <Input
                type="number"
                min={1}
                {...purchaseForm.register("actual_qty", { valueAsNumber: true })}
              />
            </Field>

            <Field
              label="Unit Price / Base (৳)"
              error={purchaseForm.formState.errors.actual_price?.message}
            >
              <Input
                type="number"
                step="0.01"
                min={0}
                {...purchaseForm.register("actual_price", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Transport Cost per Unit (৳)">
              <Input
                type="number"
                step="0.01"
                min={0}
                {...purchaseForm.register("unit_transport_cost", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Label Cost per Unit (৳)">
              <Input
                type="number"
                step="0.01"
                min={0}
                {...purchaseForm.register("unit_label_cost", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Other Cost per Unit (৳)">
              <Input
                type="number"
                step="0.01"
                min={0}
                {...purchaseForm.register("unit_other_cost", { valueAsNumber: true })}
              />
            </Field>

            {/* Live computed display */}
            <div className="rounded-md bg-muted px-3 py-2 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit Cost</span>
                <span className="font-semibold tabular-nums">৳{computedUnitCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold tabular-nums">৳{computedTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Assets */}
            {formAssets.length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Assets Received (Optional)
                </p>
                <div className="space-y-3">
                  {formAssets.map((a) => (
                    <Field key={a.id} label={a.name}>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={formAssetQtys[a.id] ?? ""}
                        onChange={(e) =>
                          setFormAssetQtys((prev) => ({
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

            <Field label="Note">
              <Textarea placeholder="Any additional info…" {...purchaseForm.register("note")} />
            </Field>

            <Field label="Remarks">
              <Textarea placeholder="Internal remarks…" {...purchaseForm.register("remarks")} />
            </Field>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={purchaseForm.formState.isSubmitting}
                className="w-1/2"
              >
                {purchaseForm.formState.isSubmitting
                  ? editTarget
                    ? "Saving…"
                    : "Creating…"
                  : editTarget
                    ? "Save Changes"
                    : "Create Purchase"}
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

      {/* Add Payment sheet */}
      <Sheet
        open={paymentTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPaymentTarget(null);
        }}
      >
        <SheetContent className="!w-full sm:max-w-md overflow-y-auto">
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

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Purchase"
        description={`Permanently delete the purchase for "${deleteTarget?.product_name}"?`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />

      {/* Delete payment confirm */}
      <ConfirmDialog
        open={deletePaymentTarget !== null}
        onOpenChange={(open) => !open && setDeletePaymentTarget(null)}
        title="Delete Payment"
        description={`Delete payment of ৳${Number(deletePaymentTarget?.amount ?? 0).toFixed(2)} on ${formatDate(
          deletePaymentTarget?.paid_at
        )}?`}
        confirmLabel="Delete"
        loading={deletingPayment}
        onConfirm={handleDeletePayment}
      />

      {/* Purchase details sidebar */}
      <Sheet open={detailsTarget !== null} onOpenChange={(open) => !open && setDetailsTarget(null)}>
        <SheetContent className="!w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Purchase Details</SheetTitle>
          </SheetHeader>
          {detailsTarget && (
            <div className="mt-6 px-4 pb-8 space-y-6">
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Purchase Info
                </h3>
                <dl className="space-y-2">
                  <DetailRow
                    label="Product"
                    value={`${detailsTarget.product_name ?? "—"} ${detailsTarget.product_unit ? `(${detailsTarget.product_unit})` : ""}`}
                  />
                  <DetailRow label="Supplier" value={detailsTarget.supplier_name ?? "—"} />
                  <DetailRow label="Qty" value={String(detailsTarget.actual_qty ?? "—")} />
                  {detailsTarget.unit && <DetailRow label="Unit" value={detailsTarget.unit} />}
                  <DetailRow
                    label="Unit Price"
                    value={
                      detailsTarget.actual_price
                        ? `৳${Number(detailsTarget.actual_price).toFixed(2)}`
                        : "—"
                    }
                  />
                  {Number(detailsTarget.unit_transport_cost) > 0 && (
                    <DetailRow
                      label="Transport/Unit"
                      value={`৳${Number(detailsTarget.unit_transport_cost).toFixed(2)}`}
                    />
                  )}
                  {Number(detailsTarget.unit_label_cost) > 0 && (
                    <DetailRow
                      label="Label/Unit"
                      value={`৳${Number(detailsTarget.unit_label_cost).toFixed(2)}`}
                    />
                  )}
                  {Number(detailsTarget.unit_other_cost) > 0 && (
                    <DetailRow
                      label="Other/Unit"
                      value={`৳${Number(detailsTarget.unit_other_cost).toFixed(2)}`}
                    />
                  )}
                  <DetailRow
                    label="Total Cost/Unit"
                    value={`৳${(Number(detailsTarget.actual_price ?? 0) + Number(detailsTarget.unit_transport_cost ?? 0) + Number(detailsTarget.unit_label_cost ?? 0) + Number(detailsTarget.unit_other_cost ?? 0)).toFixed(2)}`}
                  />
                  <DetailRow
                    label="Total"
                    value={
                      detailsTarget.actual_total
                        ? `৳${Number(detailsTarget.actual_total).toFixed(2)}`
                        : "—"
                    }
                  />
                  <DetailRow label="Purchase Date" value={formatDate(detailsTarget.purchased_at)} />
                  {detailsTarget.note && <DetailRow label="Note" value={detailsTarget.note} />}
                  {detailsTarget.remarks && (
                    <DetailRow label="Remarks" value={detailsTarget.remarks} />
                  )}
                </dl>
              </section>

              {detailAssets.length > 0 && (
                <>
                  <div className="border-t border-border" />
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Assets Received
                    </h3>
                    <div className="space-y-2">
                      {detailAssets.map((a) => (
                        <div
                          key={a.asset_id}
                          className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                        >
                          <span className="text-sm font-medium">{a.asset_name}</span>
                          <span className="text-sm tabular-nums text-muted-foreground">
                            ×{a.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}

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
                            {formatDate(p.paid_at)}
                            {p.payment_method && ` · ${p.payment_method}`}
                            {p.from_personal && " · Personal"}
                          </p>
                          {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                          onClick={() => setDeletePaymentTarget(p)}
                          title="Delete payment"
                        >
                          <Trash2 className="size-3" />
                        </Button>
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
