"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Pencil, Trash2 } from "lucide-react";

import { pricingTierSchema, type PricingTierInput } from "@/lib/schemas/pricing-tier";
import { formatTaka } from "@/lib/utils";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Product = { id: number; name: string; unit: string };
type Tier = {
  id: number;
  product_id: number;
  product_name: string;
  product_unit: string;
  name: string;
  unit_price: string;
  min_qty: number;
};

type Mode = "create" | "edit";

function PricingTiersInner() {
  const [products, setProducts] = useState<Product[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);

  const form = useForm<z.input<typeof pricingTierSchema>, unknown, PricingTierInput>({
    resolver: zodResolver(pricingTierSchema),
    defaultValues: { product_id: 0, name: "", unit_price: 0, min_qty: 1 },
  });
  const productId = form.watch("product_id");

  async function fetchTiers() {
    const qs = filterProduct !== "all" ? `?product_id=${filterProduct}` : "";
    const res = await fetch(`/api/settings/pricing-tiers${qs}`);
    setTiers(await res.json());
    setLoading(false);
  }

  async function fetchProducts() {
    const res = await fetch("/api/settings/products");
    setProducts(await res.json());
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchTiers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProduct]);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    form.reset({ product_id: filterProduct !== "all" ? Number(filterProduct) : 0, name: "", unit_price: 0, min_qty: 1 });
    setSheetOpen(true);
  }

  function openEdit(t: Tier) {
    setMode("edit");
    setEditingId(t.id);
    form.reset({ product_id: t.product_id, name: t.name, unit_price: Number(t.unit_price), min_qty: t.min_qty });
    setSheetOpen(true);
  }

  async function onSubmit(data: PricingTierInput) {
    const url = mode === "create" ? "/api/settings/pricing-tiers" : `/api/settings/pricing-tiers/${editingId}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success(mode === "create" ? "Tier added" : "Tier updated");
      setSheetOpen(false);
      fetchTiers();
    } else {
      toast.error("Please fix the errors");
    }
  }

  async function handleDelete(t: Tier) {
    const res = await fetch(`/api/settings/pricing-tiers/${t.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Tier deleted");
      fetchTiers();
    } else {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pricing Tiers</h1>
          <p className="text-sm text-muted-foreground">Per-product price levels (Regular, Bulk, VIP).</p>
        </div>
        <Button size="sm" onClick={openCreate} disabled={products.length === 0}>
          <PlusIcon className="size-4" />
          Add Tier
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Product</Label>
        <Select value={filterProduct} onValueChange={(v) => setFilterProduct(v ?? "all")}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All products" />
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
      </div>

      {products.length === 0 && (
        <p className="text-sm text-muted-foreground">Add a product first before creating pricing tiers.</p>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Tier Name</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Min Qty</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  Loading…
                </TableCell>
              </TableRow>
            ) : tiers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  No pricing tiers yet
                </TableCell>
              </TableRow>
            ) : (
              tiers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.product_name}</TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>{formatTaka(t.unit_price)}</TableCell>
                  <TableCell>{t.min_qty}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)} className="size-7 hover:bg-muted">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(t)}
                        className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
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
            <SheetTitle>{mode === "create" ? "Add Pricing Tier" : "Edit Pricing Tier"}</SheetTitle>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5 px-4">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select
                value={productId ? String(productId) : ""}
                onValueChange={(v) => form.setValue("product_id", Number(v), { shouldValidate: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.product_id && (
                <p className="text-xs text-destructive">{form.formState.errors.product_id.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tier Name</Label>
              <Input placeholder="Regular" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Unit Price (৳)</Label>
              <Input type="number" step="0.01" {...form.register("unit_price")} />
              {form.formState.errors.unit_price && (
                <p className="text-xs text-destructive">{form.formState.errors.unit_price.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Minimum Qty</Label>
              <Input type="number" {...form.register("min_qty")} />
              {form.formState.errors.min_qty && (
                <p className="text-xs text-destructive">{form.formState.errors.min_qty.message}</p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-1/2">
                {form.formState.isSubmitting ? "Saving…" : mode === "create" ? "Create" : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} className="w-1/2">
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function PricingTiersPage() {
  return (
    <AdminGuard>
      <PricingTiersInner />
    </AdminGuard>
  );
}
