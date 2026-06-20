"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Pencil, Power } from "lucide-react";

import { supplierSchema, type SupplierInput } from "@/lib/schemas/supplier";
import { formatTaka } from "@/lib/utils";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Supplier = {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  area: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bkash: string | null;
  nagad: string | null;
  default_price: string | null;
  notes: string | null;
  is_active: boolean;
};

type Mode = "create" | "edit";

const emptyForm: SupplierInput = {
  name: "",
  contact_person: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  area: "",
  bank_name: "",
  bank_account: "",
  bkash: "",
  nagad: "",
  default_price: null,
  notes: "",
  is_active: true,
};

function SuppliersInner() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);

  const form = useForm<z.input<typeof supplierSchema>, unknown, SupplierInput>({
    resolver: zodResolver(supplierSchema),
    defaultValues: emptyForm,
  });
  const isActive = form.watch("is_active");

  async function fetchSuppliers() {
    const res = await fetch(`/api/settings/suppliers${showAll ? "?all=true" : ""}`);
    setSuppliers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    form.reset(emptyForm);
    setSheetOpen(true);
  }

  function openEdit(s: Supplier) {
    setMode("edit");
    setEditingId(s.id);
    form.reset({
      name: s.name,
      contact_person: s.contact_person ?? "",
      phone: s.phone ?? "",
      whatsapp: s.whatsapp ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      area: s.area ?? "",
      bank_name: s.bank_name ?? "",
      bank_account: s.bank_account ?? "",
      bkash: s.bkash ?? "",
      nagad: s.nagad ?? "",
      default_price: s.default_price ? Number(s.default_price) : null,
      notes: s.notes ?? "",
      is_active: s.is_active,
    });
    setSheetOpen(true);
  }

  async function onSubmit(data: SupplierInput) {
    const url = mode === "create" ? "/api/settings/suppliers" : `/api/settings/suppliers/${editingId}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      toast.success(mode === "create" ? "Supplier added" : "Supplier updated");
      setSheetOpen(false);
      fetchSuppliers();
    } else {
      toast.error("Please fix the errors");
    }
  }

  async function handleDeactivate(s: Supplier) {
    const res = await fetch(`/api/settings/suppliers/${s.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Supplier deactivated");
      fetchSuppliers();
    } else {
      toast.error("Failed to deactivate");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Farms and vendors you buy stock from.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showAll} onCheckedChange={setShowAll} />
            Show inactive
          </label>
          <Button size="sm" onClick={openCreate}>
            <PlusIcon className="size-4" />
            Add Supplier
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>bKash</TableHead>
              <TableHead>Default Price</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  Loading…
                </TableCell>
              </TableRow>
            ) : suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  No suppliers yet
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contact_person ?? "—"}</TableCell>
                  <TableCell>{s.phone ?? "—"}</TableCell>
                  <TableCell>{s.bkash ?? "—"}</TableCell>
                  <TableCell>{s.default_price ? formatTaka(s.default_price) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? "default" : "secondary"}>
                      {s.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)} className="size-7 hover:bg-muted">
                        <Pencil className="size-3.5" />
                      </Button>
                      {s.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeactivate(s)}
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
            <SheetTitle>{mode === "create" ? "Add Supplier" : "Edit Supplier"}</SheetTitle>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5 px-4 pb-8">
            <Field label="Name" error={form.formState.errors.name?.message}>
              <Input placeholder="Sunrise Farm" {...form.register("name")} />
            </Field>
            <Field label="Contact Person">
              <Input {...form.register("contact_person")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <Input {...form.register("phone")} />
              </Field>
              <Field label="WhatsApp">
                <Input {...form.register("whatsapp")} />
              </Field>
            </div>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} />
            </Field>
            <Field label="Address">
              <Textarea {...form.register("address")} />
            </Field>
            <Field label="Area">
              <Input placeholder="Region of the farm" {...form.register("area")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank Name">
                <Input {...form.register("bank_name")} />
              </Field>
              <Field label="Bank Account">
                <Input {...form.register("bank_account")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="bKash">
                <Input {...form.register("bkash")} />
              </Field>
              <Field label="Nagad">
                <Input {...form.register("nagad")} />
              </Field>
            </div>
            <Field label="Default Price (৳)">
              <Input type="number" step="0.01" {...form.register("default_price")} />
            </Field>
            <Field label="Notes">
              <Textarea {...form.register("notes")} />
            </Field>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={isActive} onCheckedChange={(v) => form.setValue("is_active", v)} />
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

export default function SuppliersPage() {
  return (
    <AdminGuard>
      <SuppliersInner />
    </AdminGuard>
  );
}
