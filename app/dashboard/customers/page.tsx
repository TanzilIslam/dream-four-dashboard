"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Pencil, Power, ArrowUp, ArrowDown, SlidersHorizontal, X } from "lucide-react";

import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@/lib/schemas/customer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  area_id: number;
  area_name: string | null;
  pricing_tier_id: number | null;
  tier_name: string | null;
  tier_unit_price: string | null;
  tier_min_qty: number | null;
  tier_product_unit: string | null;
  partner_name: string | null;
  due_allowed: boolean;
  max_due: string;
  delivery_frequency: string;
  delivery_interval: number;
  customer_type: "home" | "confectionery" | "hotel" | "restaurant" | null;
  notes: string | null;
  is_active: boolean;
};

type Area = { id: number; name: string };
type Tier = { id: number; name: string; unit_price: string; min_qty: number; product_unit: string };

type Mode = "create" | "edit";

type Filters = {
  search: string;
  area_id: string;
  customer_type: string;
  pricing_tier_id: string;
  due_allowed: string;
  status: string;
  delivery_frequency: string;
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  area_id: "all",
  customer_type: "all",
  pricing_tier_id: "all",
  due_allowed: "all",
  status: "active",
  delivery_frequency: "all",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [paymentDefaults, setPaymentDefaults] = useState<{
    due_allowed: boolean;
    max_due_per_customer: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Customer | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [nameSortDir, setNameSortDir] = useState<"asc" | "desc">("asc");

  // Fetch inactive from API when status filter requires it
  const showInactive = filters.status !== "active";

  const createForm = useForm<CreateCustomerInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createCustomerSchema) as any,
    defaultValues: {
      name: "",
      phone: "",
      whatsapp: "",
      address: "",
      area_id: 0,
      pricing_tier_id: null,
      due_allowed: true,
      max_due: 1000,
      delivery_frequency: "daily",
      delivery_interval: 1,
      notes: "",
      is_active: true,
    },
  });

  const editForm = useForm<UpdateCustomerInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(updateCustomerSchema) as any,
  });

  const form = mode === "create" ? createForm : editForm;

  const createAreaId = useWatch({ control: createForm.control, name: "area_id", defaultValue: 0 });
  const editAreaId = useWatch({ control: editForm.control, name: "area_id", defaultValue: 0 });
  const areaId = mode === "create" ? createAreaId : editAreaId;

  const createDueAllowed = useWatch({
    control: createForm.control,
    name: "due_allowed",
    defaultValue: true,
  });
  const editDueAllowed = useWatch({
    control: editForm.control,
    name: "due_allowed",
    defaultValue: true,
  });
  const dueAllowed = mode === "create" ? createDueAllowed : editDueAllowed;

  const createIsActive = useWatch({
    control: createForm.control,
    name: "is_active",
    defaultValue: true,
  });
  const editIsActive = useWatch({
    control: editForm.control,
    name: "is_active",
    defaultValue: true,
  });
  const isActive = mode === "create" ? createIsActive : editIsActive;

  const createTierId = useWatch({
    control: createForm.control,
    name: "pricing_tier_id",
    defaultValue: null,
  });
  const editTierId = useWatch({
    control: editForm.control,
    name: "pricing_tier_id",
    defaultValue: null,
  });
  const selectedTierId = mode === "create" ? createTierId : editTierId;

  const createDeliveryFreq = useWatch({
    control: createForm.control,
    name: "delivery_frequency",
    defaultValue: "daily",
  });
  const editDeliveryFreq = useWatch({
    control: editForm.control,
    name: "delivery_frequency",
    defaultValue: "daily",
  });
  const deliveryFrequency =
    ((mode === "create" ? createDeliveryFreq : editDeliveryFreq) as string) ?? "daily";

  const createCustomerType = useWatch({
    control: createForm.control,
    name: "customer_type",
    defaultValue: null,
  });
  const editCustomerType = useWatch({
    control: editForm.control,
    name: "customer_type",
    defaultValue: null,
  });
  const customerType = mode === "create" ? createCustomerType : editCustomerType;

  const selectedAreaName = areas.find((a) => a.id === areaId)?.name;
  const selectedTier = tiers.find((t) => t.id === selectedTierId);
  const selectedTierLabel = selectedTier
    ? `${selectedTier.name}-${selectedTier.unit_price}tk-${selectedTier.min_qty}${selectedTier.product_unit}`
    : null;

  // Active filter count (excludes defaults)
  const activeFilterCount = [
    filters.search !== "",
    filters.area_id !== "all",
    filters.customer_type !== "all",
    filters.pricing_tier_id !== "all",
    filters.due_allowed !== "all",
    filters.status !== "active",
    filters.delivery_frequency !== "all",
  ].filter(Boolean).length;

  // Frontend filtering + sorting
  const filteredCustomers = [...customers]
    .filter((c) => {
      if (
        filters.search &&
        !c.name.toLowerCase().includes(filters.search.toLowerCase()) &&
        !(c.phone ?? "").includes(filters.search)
      )
        return false;
      if (filters.area_id !== "all" && String(c.area_id) !== filters.area_id) return false;
      if (filters.customer_type !== "all" && (c.customer_type ?? "none") !== filters.customer_type)
        return false;
      if (
        filters.pricing_tier_id !== "all" &&
        String(c.pricing_tier_id ?? "none") !== filters.pricing_tier_id
      )
        return false;
      if (filters.due_allowed !== "all") {
        if (filters.due_allowed === "yes" && !c.due_allowed) return false;
        if (filters.due_allowed === "no" && c.due_allowed) return false;
      }
      if (filters.status === "active" && !c.is_active) return false;
      if (filters.status === "inactive" && c.is_active) return false;
      if (
        filters.delivery_frequency !== "all" &&
        c.delivery_frequency !== filters.delivery_frequency
      )
        return false;
      return true;
    })
    .sort((a, b) =>
      nameSortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );

  useEffect(() => {
    fetch(`/api/customers${showInactive ? "?inactive=true" : ""}`)
      .then((res) => res.json())
      .then((data) => {
        setCustomers(data);
        setLoading(false);
      });
  }, [showInactive]);

  useEffect(() => {
    fetch("/api/settings/areas")
      .then((res) => res.json())
      .then((data) => setAreas(data));
    fetch("/api/settings/pricing-tiers")
      .then((res) => res.json())
      .then((data) => setTiers(data));
    fetch("/api/settings/payment-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setPaymentDefaults(data));
  }, []);

  async function refreshCustomers() {
    const res = await fetch(`/api/customers${showInactive ? "?inactive=true" : ""}`);
    setCustomers(await res.json());
  }

  function openCreate() {
    setMode("create");
    setEditingId(null);
    createForm.reset({
      name: "",
      phone: "",
      whatsapp: "",
      address: "",
      area_id: 0,
      pricing_tier_id: null,
      due_allowed: paymentDefaults?.due_allowed ?? true,
      max_due: paymentDefaults ? Number(paymentDefaults.max_due_per_customer) : 1000,
      delivery_frequency: "daily",
      delivery_interval: 1,
      customer_type: null,
      notes: "",
      is_active: true,
    });
    setSheetOpen(true);
  }

  function openEdit(c: Customer) {
    setMode("edit");
    setEditingId(c.id);
    editForm.reset({
      name: c.name,
      phone: c.phone ?? "",
      whatsapp: c.whatsapp ?? "",
      address: c.address ?? "",
      area_id: c.area_id,
      pricing_tier_id: c.pricing_tier_id,
      due_allowed: c.due_allowed,
      max_due: Number(c.max_due),
      delivery_frequency: c.delivery_frequency as "daily" | "alternate" | "weekly",
      delivery_interval: c.delivery_interval,
      customer_type: c.customer_type ?? null,
      notes: c.notes ?? "",
      is_active: c.is_active,
    });
    setSheetOpen(true);
  }

  async function onSubmit(data: CreateCustomerInput | UpdateCustomerInput) {
    const url = mode === "create" ? "/api/customers" : `/api/customers/${editingId}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success(mode === "create" ? "Customer added" : "Customer updated");
      setSheetOpen(false);
      refreshCustomers();
    } else {
      const json = await res.json().catch(() => null);
      toast.error(json?.error ?? "Something went wrong");
    }
  }

  async function handleDeactivateConfirmed() {
    if (!confirmTarget) return;
    setConfirming(true);
    const res = await fetch(`/api/customers/${confirmTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Customer deactivated");
      setConfirmTarget(null);
      refreshCustomers();
    } else {
      toast.error("Failed to deactivate");
    }
    setConfirming(false);
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Manage your delivery customers.
            {!loading && (
              <span className="ml-1 font-medium text-foreground">
                {filteredCustomers.length}
                {filteredCustomers.length !== customers.length
                  ? ` of ${customers.length}`
                  : ""}{" "}
                total
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterOpen(true)}
            className="relative"
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <PlusIcon className="size-4" />
            Add Customer
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-foreground text-inherit"
                  onClick={() => setNameSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                >
                  Name
                  {nameSortDir === "asc" ? (
                    <ArrowUp className="size-3" />
                  ) : (
                    <ArrowDown className="size-3" />
                  )}
                </button>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Pricing Tier</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Due Allowed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  {activeFilterCount > 0 ? "No customers match your filters" : "No customers yet"}
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    {c.customer_type ? (
                      <Badge variant="outline" className="capitalize">
                        {c.customer_type}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{c.area_name ?? "—"}</TableCell>
                  <TableCell>
                    {c.tier_name
                      ? `${c.tier_name}-${c.tier_unit_price}tk-${c.tier_min_qty}${c.tier_product_unit}`
                      : "—"}
                  </TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.due_allowed ? "secondary" : "outline"}>
                      {c.due_allowed ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.partner_name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(c)}
                        className="size-7 hover:bg-muted"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {c.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmTarget(c)}
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

      {/* ── Filter Sheet ──────────────────────────────────────────── */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent className="w-full sm:max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>

          <div className="mt-6 px-4 pb-8 space-y-6">
            {/* Search */}
            <FilterSection label="Search">
              <Input
                placeholder="Name or phone…"
                value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
              />
            </FilterSection>

            {/* Status */}
            <FilterSection label="Status">
              <FilterPills
                options={[
                  { label: "Active", value: "active" },
                  { label: "Inactive", value: "inactive" },
                ]}
                value={filters.status}
                onChange={(v) => setFilter("status", v)}
              />
            </FilterSection>

            {/* Customer Type */}
            <FilterSection label="Customer Type">
              <FilterPills
                options={[
                  { label: "All", value: "all" },
                  { label: "Home", value: "home" },
                  { label: "Confectionery", value: "confectionery" },
                  { label: "Hotel", value: "hotel" },
                  { label: "Restaurant", value: "restaurant" },
                  { label: "Not set", value: "none" },
                ]}
                value={filters.customer_type}
                onChange={(v) => setFilter("customer_type", v)}
              />
            </FilterSection>

            {/* Area */}
            <FilterSection label="Area">
              <Select
                value={filters.area_id}
                onValueChange={(v) => setFilter("area_id", v ?? "all")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {filters.area_id === "all"
                      ? "All areas"
                      : (areas.find((a) => String(a.id) === filters.area_id)?.name ?? "All areas")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All areas</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterSection>

            {/* Pricing Tier */}
            <FilterSection label="Pricing Tier">
              <Select
                value={filters.pricing_tier_id}
                onValueChange={(v) => setFilter("pricing_tier_id", v ?? "all")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {filters.pricing_tier_id === "all"
                      ? "All tiers"
                      : filters.pricing_tier_id === "none"
                        ? "No tier"
                        : (() => {
                            const t = tiers.find((t) => String(t.id) === filters.pricing_tier_id);
                            return t ? `${t.name} — ${t.unit_price}tk` : "All tiers";
                          })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tiers</SelectItem>
                  <SelectItem value="none">No tier</SelectItem>
                  {tiers.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name} — {t.unit_price}tk
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterSection>

            {/* Due Allowed */}
            <FilterSection label="Due Allowed">
              <FilterPills
                options={[
                  { label: "All", value: "all" },
                  { label: "Yes", value: "yes" },
                  { label: "No", value: "no" },
                ]}
                value={filters.due_allowed}
                onChange={(v) => setFilter("due_allowed", v)}
              />
            </FilterSection>

            {/* Delivery Frequency */}
            <FilterSection label="Delivery Frequency">
              <FilterPills
                options={[
                  { label: "All", value: "all" },
                  { label: "Daily", value: "daily" },
                  { label: "Alternate", value: "alternate" },
                  { label: "Weekly", value: "weekly" },
                ]}
                value={filters.delivery_frequency}
                onChange={(v) => setFilter("delivery_frequency", v)}
              />
            </FilterSection>

            {activeFilterCount > 0 && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
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

      {/* ── Create / Edit Sheet ───────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{mode === "create" ? "Add Customer" : "Edit Customer"}</SheetTitle>
          </SheetHeader>

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <form onSubmit={form.handleSubmit(onSubmit as any)} className="mt-6 space-y-5 px-4 pb-8">
            <Field label="Name" error={form.formState.errors.name?.message}>
              <Input placeholder="Customer name" {...form.register("name")} />
            </Field>

            <Field
              label="Area"
              error={
                (form.formState.errors as Record<string, { message?: string }>).area_id?.message
              }
            >
              <Select
                value={areaId ? String(areaId) : ""}
                onValueChange={(v) => form.setValue("area_id", Number(v), { shouldValidate: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select area">
                    {selectedAreaName ?? undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Pricing Tier">
              <Select
                value={selectedTierId ? String(selectedTierId) : "none"}
                onValueChange={(v) =>
                  form.setValue("pricing_tier_id", v === "none" ? null : Number(v))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No tier">
                    {selectedTierId ? selectedTierLabel : "No tier"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No tier</SelectItem>
                  {tiers.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}-{t.unit_price}tk-{t.min_qty}
                      {t.product_unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Phone">
              <Input placeholder="+880..." {...form.register("phone")} />
            </Field>

            <Field label="WhatsApp">
              <Input placeholder="+880..." {...form.register("whatsapp")} />
            </Field>

            <Field label="Address">
              <Textarea {...form.register("address")} />
            </Field>

            <Field label="Delivery Frequency">
              <Select
                value={deliveryFrequency}
                onValueChange={(v) =>
                  form.setValue("delivery_frequency", v as "daily" | "alternate" | "weekly")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="alternate">Alternate days</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="flex items-center justify-between">
              <div>
                <Label>Due Allowed</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Can this customer carry an outstanding balance?
                </p>
              </div>
              <Switch
                checked={dueAllowed ?? true}
                onCheckedChange={(v) => form.setValue("due_allowed", v)}
              />
            </div>

            {dueAllowed && (
              <Field label="Max Due (৳)">
                <Input
                  type="number"
                  step="0.01"
                  {...form.register("max_due", { valueAsNumber: true })}
                />
              </Field>
            )}

            <Field label="Customer Type">
              <Select
                value={customerType ?? "none"}
                onValueChange={(v) =>
                  form.setValue(
                    "customer_type",
                    v === "none" ? null : (v as "home" | "confectionery" | "hotel" | "restaurant")
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type">
                    {customerType
                      ? customerType.charAt(0).toUpperCase() + customerType.slice(1)
                      : "Not specified"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="confectionery">Confectionery</SelectItem>
                  <SelectItem value="hotel">Hotel</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Notes">
              <Textarea {...form.register("notes")} />
            </Field>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={isActive ?? true}
                onCheckedChange={(v) => form.setValue("is_active", v)}
              />
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
        title="Deactivate Customer"
        description={`Are you sure you want to deactivate "${confirmTarget?.name}"?`}
        confirmLabel="Deactivate"
        loading={confirming}
        onConfirm={handleDeactivateConfirmed}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function FilterPills({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
            value === o.value
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
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
