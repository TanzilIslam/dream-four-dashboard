"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";

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
  const [submitting, setSubmitting] = useState(false);

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

  async function loadStock() {
    const res = await fetch("/api/stock");
    const data = await res.json();
    setStock(
      data.map((row: StockRow) => ({
        ...row,
        purchased_qty: Number(row.purchased_qty),
        reserved_qty: Number(row.reserved_qty),
        delivered_qty: Number(row.delivered_qty),
        returned_qty: Number(row.returned_qty),
        adjusted_qty: Number(row.adjusted_qty),
        available_qty: Number(row.available_qty),
      }))
    );
  }

  async function loadAdjustments() {
    const res = await fetch("/api/stock/adjustments");
    if (res.ok) setAdjustments(await res.json());
  }

  useEffect(() => {
    Promise.all([loadStock()]).then(() => setLoading(false));

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
      .then((data: Product[]) => setProducts(data.filter((p) => p)));
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
    setSubmitting(true);
    const payload = {
      ...values,
      quantity: adjType === "deduct" ? -Math.abs(values.quantity) : Math.abs(values.quantity),
    };
    const res = await fetch("/api/stock/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
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
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Stock</h1>
          <p className="text-sm text-muted-foreground">
            Current inventory levels across all products.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openSheet}>
            <PlusIcon className="mr-1.5 h-4 w-4" />
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 8 : 7}
                  className="text-center py-10 text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : stock.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 8 : 7}
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
                        className={`text-right text-muted-foreground ${
                          row.adjusted_qty !== 0
                            ? row.adjusted_qty < 0
                              ? "text-red-500"
                              : "text-blue-500"
                            : ""
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
                    <TableCell className="text-muted-foreground">{adj.date.slice(0, 10)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {adj.note ?? "—"}
                    </TableCell>
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

      {/* Log Adjustment Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Log Stock Adjustment</SheetTitle>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
            {/* Product */}
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select
                value={form.watch("product_id") ? String(form.watch("product_id")) : ""}
                onValueChange={(v) =>
                  form.setValue("product_id", Number(v), { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({p.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.product_id && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.product_id.message}
                </p>
              )}
            </div>

            {/* Type toggle */}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAdjType("deduct")}
                  className={`flex-1 py-2 text-sm transition-colors ${
                    adjType === "deduct"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Deduct (wastage)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjType("add")}
                  className={`flex-1 py-2 text-sm transition-colors ${
                    adjType === "add"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Add (correction)
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                {...form.register("quantity", { valueAsNumber: true })}
              />
              {form.formState.errors.quantity && (
                <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input
                placeholder='e.g. "broken", "expired", "recount"'
                {...form.register("reason")}
              />
              {form.formState.errors.reason && (
                <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" {...form.register("date")} />
              {form.formState.errors.date && (
                <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
              )}
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea rows={2} {...form.register("note")} />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Saving…" : "Save Adjustment"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
