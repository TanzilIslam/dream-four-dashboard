"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Pencil, Power } from "lucide-react";

import { productSchema, type ProductInput } from "@/lib/schemas/product";
import { formatTaka } from "@/lib/utils";
import { AdminGuard } from "@/components/admin-guard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Product = {
  id: number;
  name: string;
  unit: string;
  default_price: string | null;
  low_stock_threshold: number;
  is_active: boolean;
};

type Mode = "create" | "edit";

const emptyForm: ProductInput = {
  name: "",
  unit: "piece",
  default_price: null,
  low_stock_threshold: 100,
  is_active: true,
};

function ProductsInner() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Product | null>(null);
  const [confirming, setConfirming] = useState(false);

  const form = useForm<z.input<typeof productSchema>, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: emptyForm,
  });
  const isActive = useWatch({ control: form.control, name: "is_active", defaultValue: true });

  async function fetchProducts() {
    const res = await fetch(`/api/settings/products${showInactive ? "?inactive=true" : ""}`);
    setProducts(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    fetch(`/api/settings/products${showInactive ? "?inactive=true" : ""}`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      });
  }, [showInactive]);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    form.reset(emptyForm);
    setSheetOpen(true);
  }

  function openEdit(p: Product) {
    setMode("edit");
    setEditingId(p.id);
    form.reset({
      name: p.name,
      unit: p.unit,
      default_price: p.default_price ? Number(p.default_price) : null,
      low_stock_threshold: p.low_stock_threshold,
      is_active: p.is_active,
    });
    setSheetOpen(true);
  }

  async function onSubmit(data: ProductInput) {
    const url =
      mode === "create" ? "/api/settings/products" : `/api/settings/products/${editingId}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success(mode === "create" ? "Product added" : "Product updated");
      setSheetOpen(false);
      fetchProducts();
    } else {
      toast.error("Please fix the errors");
    }
  }

  async function handleDeactivateConfirmed() {
    if (!confirmTarget) return;
    setConfirming(true);
    const res = await fetch(`/api/settings/products/${confirmTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Product deactivated");
      setConfirmTarget(null);
      fetchProducts();
    } else {
      toast.error("Failed to deactivate");
    }
    setConfirming(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">
            Items you sell, with default price and stock alert level.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            Show inactive
          </label>
          <Button size="sm" onClick={openCreate}>
            <PlusIcon className="size-4" />
            Add Product
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Default Price</TableHead>
              <TableHead>Low Stock Threshold</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Loading…
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  No products yet
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.unit}</TableCell>
                  <TableCell>{p.default_price ? formatTaka(p.default_price) : "—"}</TableCell>
                  <TableCell>{p.low_stock_threshold}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(p)}
                        className="size-7 hover:bg-muted"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {p.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmTarget(p)}
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{mode === "create" ? "Add Product" : "Edit Product"}</SheetTitle>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5 px-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="Egg" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input placeholder="piece" {...form.register("unit")} />
              {form.formState.errors.unit && (
                <p className="text-xs text-destructive">{form.formState.errors.unit.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Default Price (৳)</Label>
              <Input type="number" step="0.01" {...form.register("default_price")} />
            </div>
            <div className="space-y-1.5">
              <Label>Low Stock Threshold</Label>
              <Input type="number" {...form.register("low_stock_threshold")} />
              {form.formState.errors.low_stock_threshold && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.low_stock_threshold.message}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={isActive} onCheckedChange={(v) => form.setValue("is_active", v)} />
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

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Deactivate Product"
        description={`Are you sure you want to deactivate "${confirmTarget?.name}"?`}
        confirmLabel="Deactivate"
        loading={confirming}
        onConfirm={handleDeactivateConfirmed}
      />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <AdminGuard>
      <ProductsInner />
    </AdminGuard>
  );
}
