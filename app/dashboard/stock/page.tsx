"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon, HistoryIcon, Loader2 } from "lucide-react";

import {
  createStockAdjustmentSchema,
  type CreateStockAdjustmentInput,
} from "@/lib/schemas/stock-adjustment";
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

type StockRow = {
  id: number;
  name: string;
  unit: string;
  low_stock_threshold: number | null;
  purchased_qty: number;
  reserved_qty: number;
  delivered_qty: number;
  returned_qty: number;
  adjusted_qty: number;
  available_qty: number;
};

type Product = { id: number; name: string; unit: string };

type Adjustment = {
  id: number;
  product_id: number;
  product_name: string | null;
  product_unit: string | null;
  quantity: number;
  reason: string;
  date: string;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
};

type PurchaseReceipt = {
  id: number;
  purchased_at: string;
  actual_qty: string;
  actual_price: string;
  actual_total: string;
  note: string | null;
  admin_note: string | null;
  supplier_name: string | null;
  partner_name: string | null;
};

function stockStatus(row: StockRow): {
  label: string;
  variant: "default" | "secondary" | "destructive";
} {
  if (row.available_qty <= 0) return { label: "Out of stock", variant: "destructive" };
  if (row.low_stock_threshold != null && row.available_qty <= row.low_stock_threshold)
    return { label: "Low stock", variant: "secondary" };
  return { label: "In stock", variant: "default" };
}

export default function StockPage() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [adjType, setAdjType] = useState<"deduct" | "add">("deduct");

  const [historyTarget, setHistoryTarget] = useState<StockRow | null>(null);
  const [historyRows, setHistoryRows] = useState<PurchaseReceipt[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySummary, setHistorySummary] = useState<{
    total_qty: number;
    total_amount: number;
  } | null>(null);

  const form = useForm<CreateStockAdjustmentInput>({
    resolver: zodResolver(createStockAdjustmentSchema),
    defaultValues: {
      product_id: 0,
      quantity: 1,
      reason: "",
      date: new Date().toISOString().slice(0, 10),
      note: "",
    },
  });

  const productId = useWatch({ control: form.control, name: "product_id", defaultValue: 0 });
  const selectedProductName = products.find((p) => p.id === productId)?.name;

  function parseStock(data: StockRow[]) {
    return data.map((row) => ({
      ...row,
      purchased_qty: Number(row.purchased_qty),
      reserved_qty: Number(row.reserved_qty),
      delivered_qty: Number(row.delivered_qty),
      returned_qty: Number(row.returned_qty),
      adjusted_qty: Number(row.adjusted_qty),
      available_qty: Number(row.available_qty),
    }));
  }

  async function loadStock() {
    const res = await fetch("/api/stock");
    const data = await res.json();
    setStock(parseStock(data));
  }

  async function loadAdjustments() {
    const res = await fetch("/api/stock/adjustments");
    if (res.ok) setAdjustments(await res.json());
  }

  function openHistory(row: StockRow) {
    setHistoryTarget(row);
    setHistoryRows([]);
    setHistorySummary(null);
    setHistoryLoading(true);
    fetch(`/api/stock/${row.id}/history`)
      .then((r) => r.json())
      .then((data) => {
        setHistoryRows(data.rows ?? []);
        setHistorySummary({
          total_qty: Number(data.total_qty ?? 0),
          total_amount: Number(data.total_amount ?? 0),
        });
        setHistoryLoading(false);
      })
      .catch(() => setHistoryLoading(false));
  }

  useEffect(() => {
    fetch("/api/stock")
      .then((r) => r.json())
      .then((data) => {
        setStock(parseStock(data));
        setLoading(false);
      });

    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data) => {
        if (data.user?.role === "admin") {
          setIsAdmin(true);
          loadAdjustments();
        }
      })
      .catch(() => {});

    fetch("/api/settings/products")
      .then((r) => r.json())
      .then((data: Product[]) => setProducts(data));
  }, []);

  function openSheet() {
    form.reset({
      product_id: 0,
      quantity: 1,
      reason: "",
      date: new Date().toISOString().slice(0, 10),
      note: "",
    });
    setAdjType("deduct");
    setSheetOpen(true);
  }

  async function onSubmit(values: CreateStockAdjustmentInput) {
    const payload = {
      ...values,
      quantity: adjType === "deduct" ? -Math.abs(values.quantity) : Math.abs(values.quantity),
    };
    const res = await fetch("/api/stock/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to save adjustment");
      return;
    }
    toast.success("Adjustment logged");
    setSheetOpen(false);
    await Promise.all([loadStock(), loadAdjustments()]);
  }

  async function deleteAdjustment(id: number) {
    const res = await fetch(`/api/stock/adjustments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete adjustment");
      return;
    }
    toast.success("Adjustment removed");
    await Promise.all([loadStock(), loadAdjustments()]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Stock</h1>
          <p className="text-sm text-muted-foreground">
            Current inventory levels across all products.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openSheet}>
            <PlusIcon className="size-4" />
            Log Adjustment
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Purchased</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Returned</TableHead>
              {isAdmin && <TableHead className="text-right">Adjusted</TableHead>}
              <TableHead className="text-right">Available</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 9 : 8}
                  className="text-center py-10 text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : stock.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 9 : 8}
                  className="text-center py-10 text-muted-foreground"
                >
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              stock.map((row) => {
                const status = stockStatus(row);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.name}
                      <span className="ml-1.5 text-xs text-muted-foreground">({row.unit})</span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.purchased_qty}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.reserved_qty}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.delivered_qty}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.returned_qty}
                    </TableCell>
                    {isAdmin && (
                      <TableCell
                        className={`text-right ${
                          row.adjusted_qty < 0
                            ? "text-red-500"
                            : row.adjusted_qty > 0
                              ? "text-blue-500"
                              : "text-muted-foreground"
                        }`}
                      >
                        {row.adjusted_qty !== 0
                          ? `${row.adjusted_qty > 0 ? "+" : ""}${row.adjusted_qty}`
                          : "—"}
                      </TableCell>
                    )}
                    <TableCell
                      className={`text-right font-semibold ${
                        row.available_qty <= 0
                          ? "text-red-600"
                          : row.low_stock_threshold != null &&
                              row.available_qty <= row.low_stock_threshold
                            ? "text-yellow-600"
                            : "text-green-600"
                      }`}
                    >
                      {row.available_qty}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => openHistory(row)}
                        title="Purchase history"
                      >
                        <HistoryIcon className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Available = Purchased − Reserved (pending orders) − Delivered + Returned + Adjustments
      </p>

      {/* Adjustments history (admin only) */}
      {isAdmin && adjustments.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Adjustment History</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((adj) => (
                  <TableRow key={adj.id}>
                    <TableCell className="font-medium">
                      {adj.product_name}
                      {adj.product_unit && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({adj.product_unit})
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        adj.quantity < 0 ? "text-red-600" : "text-blue-600"
                      }`}
                    >
                      {adj.quantity > 0 ? `+${adj.quantity}` : adj.quantity}
                    </TableCell>
                    <TableCell>{adj.reason}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(adj.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{adj.note ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteAdjustment(adj.id)}
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Purchase history sheet */}
      <Sheet open={historyTarget !== null} onOpenChange={(open) => !open && setHistoryTarget(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Purchase History — {historyTarget?.name}
              {historyTarget?.unit && (
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  ({historyTarget.unit})
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          {/* Summary */}
          {historySummary && (
            <div className="mx-4 mt-3 rounded-md bg-muted/50 px-4 py-3 text-sm grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Received</p>
                <p className="text-lg font-semibold tabular-nums">
                  {historySummary.total_qty.toLocaleString()}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {historyTarget?.unit}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="text-lg font-semibold tabular-nums">
                  ৳{historySummary.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}

          <div className="px-4 mt-5">
            {historyLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : historyRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No purchases recorded yet for this product.
              </p>
            ) : (
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {new Date(r.purchased_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.supplier_name ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(r.actual_qty).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          ৳{Number(r.actual_price).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          ৳{Number(r.actual_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[140px] truncate">
                          {r.note || r.admin_note || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="px-4 mt-4 pb-6">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setHistoryTarget(null)}
            >
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Log Adjustment Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Log Stock Adjustmentss</SheetTitle>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5 px-4 pb-8">
            <Field
              label="Product"
              error={
                (form.formState.errors as Record<string, { message?: string }>).product_id?.message
              }
            >
              <Select
                value={productId ? String(productId) : ""}
                onValueChange={(v) =>
                  form.setValue("product_id", Number(v), { shouldValidate: true })
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

            <Field label="Type">
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAdjType("deduct")}
                  className={`flex-1 py-1 text-sm transition-colors ${
                    adjType === "deduct"
                      ? "bg-destructive text-white"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Deduct (wastage)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjType("add")}
                  className={`flex-1 py-1 text-sm transition-colors ${
                    adjType === "add"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Add (correction)
                </button>
              </div>
            </Field>

            <Field label="Quantity" error={form.formState.errors.quantity?.message}>
              <Input
                type="number"
                min={1}
                {...form.register("quantity", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Reason" error={form.formState.errors.reason?.message}>
              <Input
                placeholder='e.g. "broken", "expired", "recount"'
                {...form.register("reason")}
              />
            </Field>

            <Field label="Date" error={form.formState.errors.date?.message}>
              <Input type="date" {...form.register("date")} />
            </Field>

            <Field label="Note (optional)">
              <Textarea rows={2} {...form.register("note")} />
            </Field>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-1/2">
                {form.formState.isSubmitting ? "Saving…" : "Save Adjustment"}
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
