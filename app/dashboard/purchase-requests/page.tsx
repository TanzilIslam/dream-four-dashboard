"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Trash2, CheckCircle2, XCircle, ShoppingBag, Eye } from "lucide-react";
import { useWatch } from "react-hook-form";

import {
  createPurchaseRequestSchema,
  markPurchasedSchema,
  type CreatePurchaseRequestInput,
  type MarkPurchasedInput,
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
  payment_method: string | null;
  from_personal: boolean;
  note: string | null;
  created_at: string;
  supplier_name: string | null;
  product_name: string | null;
  product_unit: string | null;
  partner_name?: string | null;
};

type Supplier = { id: number; name: string };
type Product = { id: number; name: string; unit: string };

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

  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<PurchaseRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Admin action state
  const [approveTarget, setApproveTarget] = useState<PurchaseRequest | null>(null);
  const [approving, setApproving] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [rejectTarget, setRejectTarget] = useState<PurchaseRequest | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [purchaseTarget, setPurchaseTarget] = useState<PurchaseRequest | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<PurchaseRequest | null>(null);

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
      payment_method: "",
      from_personal: false,
      admin_note: "",
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
      .then((data: Product[]) => setProducts(data));
  }, []);

  async function refreshRequests() {
    const res = await fetch(`/api/purchase-requests?status=${statusFilter}`);
    setRequests(await res.json());
  }

  function openCreate() {
    createForm.reset({
      supplier_id: 0,
      product_id: 0,
      requested_qty: 1,
      estimated_price: null,
      note: "",
    });
    setCreateOpen(true);
  }

  async function onCreateSubmit(data: CreatePurchaseRequestInput) {
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
      toast.success("Request cancelled");
      setCancelTarget(null);
      refreshRequests();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to cancel");
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
    const res = await fetch(`/api/purchase-requests/${purchaseTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-purchased", ...data }),
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Purchase Requests</h1>
          <p className="text-sm text-muted-foreground">Request stock purchases from admin.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="size-4" />
          New Request
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Filter:</Label>
        <Select value={statusFilter} onValueChange={(v) => v != null && setStatusFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="purchased">Purchased</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Partner</TableHead>}
              <TableHead>Product</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Est. Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Note</TableHead>
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
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 8 : 7}
                  className="text-center text-muted-foreground py-10"
                >
                  No requests
                </TableCell>
              </TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={r.id}>
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
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                    {r.admin_note ?? r.note ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {/* Partner can cancel pending */}
                      {r.status === "pending" && !isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCancelTarget(r)}
                          className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                      {/* Admin can approve/reject pending */}
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
                      {/* Admin can mark approved as purchased */}
                      {isAdmin && r.status === "approved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            markPurchasedForm.reset({
                              actual_qty: r.requested_qty,
                              actual_price: r.estimated_price ? Number(r.estimated_price) : 0,
                              purchased_at: new Date().toISOString().slice(0, 10),
                              payment_method: "",
                              from_personal: false,
                              admin_note: "",
                            });
                            setPurchaseTarget(r);
                          }}
                          className="size-7 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          title="Mark as purchased"
                        >
                          <ShoppingBag className="size-3.5" />
                        </Button>
                      )}
                      {/* View details for purchased items */}
                      {r.status === "purchased" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDetailsTarget(r)}
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

      {/* Create sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Purchase Request</SheetTitle>
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
                {...createForm.register("estimated_price", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Note">
              <Textarea placeholder="Any additional info…" {...createForm.register("note")} />
            </Field>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={createForm.formState.isSubmitting} className="w-1/2">
                {createForm.formState.isSubmitting ? "Submitting…" : "Submit Request"}
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

      {/* Mark as purchased sheet (admin) */}
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

            <Field
              label="Purchase Date"
              error={markPurchasedForm.formState.errors.purchased_at?.message}
            >
              <Input type="date" {...markPurchasedForm.register("purchased_at")} />
            </Field>

            <Field label="Payment Method">
              <Input placeholder="Cash, bKash…" {...markPurchasedForm.register("payment_method")} />
            </Field>

            <div className="flex items-center justify-between">
              <div>
                <Label>From Personal Funds</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Partner paid from their own pocket
                </p>
              </div>
              <input
                type="checkbox"
                className="size-4"
                {...markPurchasedForm.register("from_personal")}
              />
            </div>

            <Field label="Admin Note">
              <Textarea {...markPurchasedForm.register("admin_note")} />
            </Field>

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

      {/* Cancel confirm */}
      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel Request"
        description={`Cancel the purchase request for "${cancelTarget?.product_name}"?`}
        confirmLabel="Cancel Request"
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

      {/* Purchase details sidebar */}
      <Sheet open={detailsTarget !== null} onOpenChange={(open) => !open && setDetailsTarget(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Purchase Details</SheetTitle>
          </SheetHeader>
          {detailsTarget && (
            <div className="mt-6 px-4 pb-8 space-y-6">
              {/* Request info */}
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

              {/* Purchase info */}
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
                  <DetailRow label="Payment Method" value={detailsTarget.payment_method || "—"} />
                  <DetailRow
                    label="From Personal Funds"
                    value={detailsTarget.from_personal ? "Yes" : "No"}
                  />
                  {detailsTarget.admin_note && (
                    <DetailRow label="Admin Note" value={detailsTarget.admin_note} />
                  )}
                </dl>
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
