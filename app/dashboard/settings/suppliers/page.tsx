"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Pencil, Power } from "lucide-react";

import { supplierSchema, type SupplierInput } from "@/lib/schemas/supplier";
import { formatTaka } from "@/lib/utils";
import { AdminGuard } from "@/components/admin-guard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  const [showInactive, setShowInactive] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Supplier | null>(null);
  const [confirming, setConfirming] = useState(false);

  const form = useForm<z.input<typeof supplierSchema>, unknown, SupplierInput>({
    resolver: zodResolver(supplierSchema),
    defaultValues: emptyForm,
  });
  const isActive = useWatch({ control: form.control, name: "is_active", defaultValue: true });

  async function fetchSuppliers() {
    const res = await fetch(`/api/settings/suppliers${showInactive ? "?inactive=true" : ""}`);
    setSuppliers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    fetch(`/api/settings/suppliers${showInactive ? "?inactive=true" : ""}`)
      .then((res) => res.json())
      .then((data) => {
        setSuppliers(data);
        setLoading(false);
      });
  }, [showInactive]);

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
    const url =
      mode === "create" ? "/api/settings/suppliers" : `/api/settings/suppliers/${editingId}`;
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

  async function confirmDeactivate() {
    if (!confirmTarget) return;
    setConfirming(true);
    const res = await fetch(`/api/settings/suppliers/${confirmTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Supplier deactivated");
      setConfirmTarget(null);
      fetchSuppliers();
    } else {
      toast.error("Failed to deactivate");
    }
    setConfirming(false);
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
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            Show inactive
          </label>
          <Button size="sm" onClick={openCreate}>
            <PlusIcon className="size-4" />
            Add Supplier
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(s)}
                        className="size-7 hover:bg-muted"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {s.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmTarget(s)}
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
        <SheetContent className="!w-full sm:max-w-md overflow-y-auto">
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
            <Field label="Phone">
              <Input {...form.register("phone")} />
            </Field>
            <Field label="WhatsApp">
              <Input {...form.register("whatsapp")} />
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} />
            </Field>
            <Field label="Address">
              <Textarea {...form.register("address")} />
            </Field>
            <Field label="Area">
              <Input placeholder="Region of the farm" {...form.register("area")} />
            </Field>
            <Field label="Bank Name">
              <Input {...form.register("bank_name")} />
            </Field>
            <Field label="Bank Account">
              <Input {...form.register("bank_account")} />
            </Field>
            <Field label="bKash">
              <Input {...form.register("bkash")} />
            </Field>
            <Field label="Nagad">
              <Input {...form.register("nagad")} />
            </Field>
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
        title="Deactivate Supplier"
        description={`Are you sure you want to deactivate "${confirmTarget?.name}"? It will be hidden from active lists.`}
        confirmLabel="Deactivate"
        loading={confirming}
        onConfirm={confirmDeactivate}
      />
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
