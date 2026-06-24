"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Pencil, Trash2 } from "lucide-react";

import { createExpenseSchema, type CreateExpenseInput } from "@/lib/schemas/expense";
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

type Expense = {
  id: number;
  amount: string;
  payment_method: string | null;
  description: string | null;
  date: string;
  category_id: number | null;
  area_id: number | null;
  product_id: number | null;
  category_name: string | null;
  area_name: string | null;
  product_name: string | null;
  partner_name?: string | null;
};

type Category = { id: number; name: string };
type Area = { id: number; name: string };
type Product = { id: number; name: string };

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const form = useForm<CreateExpenseInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createExpenseSchema) as any,
    defaultValues: {
      category_id: 0,
      area_id: null,
      product_id: null,
      amount: 0,
      payment_method: "",
      description: "",
      date: new Date().toISOString().slice(0, 10),
    },
  });

  const categoryId = useWatch({ control: form.control, name: "category_id", defaultValue: 0 });
  const areaId = useWatch({ control: form.control, name: "area_id", defaultValue: null });
  const productId = useWatch({ control: form.control, name: "product_id", defaultValue: null });
  const selectedCategoryName = categories.find((c) => c.id === categoryId)?.name;
  const selectedAreaName = areas.find((a) => a.id === areaId)?.name;
  const selectedProductName = products.find((p) => p.id === productId)?.name;

  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/expenses?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setExpenses(data);
        setLoading(false);
      });
  }, [from, to]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setIsAdmin(data.user?.role === "admin"))
      .catch(() => setIsAdmin(false));
    fetch("/api/settings/expense-categories")
      .then((res) => res.json())
      .then((data: Category[]) => setCategories(data));
    fetch("/api/settings/areas")
      .then((res) => res.json())
      .then((data: Area[]) => setAreas(data));
    fetch("/api/settings/products")
      .then((res) => res.json())
      .then((data: Product[]) => setProducts(data));
  }, []);

  async function refreshExpenses() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/expenses?${params}`);
    setExpenses(await res.json());
  }

  function openCreate() {
    setEditingId(null);
    form.reset({
      category_id: 0,
      area_id: null,
      product_id: null,
      amount: 0,
      payment_method: "",
      description: "",
      date: new Date().toISOString().slice(0, 10),
    });
    setSheetOpen(true);
  }

  function openEdit(e: Expense) {
    setEditingId(e.id);
    form.reset({
      category_id: e.category_id ?? 0,
      area_id: e.area_id ?? null,
      product_id: e.product_id ?? null,
      amount: Number(e.amount),
      payment_method: e.payment_method ?? "",
      description: e.description ?? "",
      date: e.date.slice(0, 10),
    });
    setSheetOpen(true);
  }

  async function deleteExpense(id: number) {
    if (!confirm("Delete this expense?")) return;
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Expense deleted");
      refreshExpenses();
    } else {
      toast.error("Failed to delete expense");
    }
  }

  async function onSubmit(data: CreateExpenseInput) {
    const url = editingId !== null ? `/api/expenses/${editingId}` : "/api/expenses";
    const method = editingId !== null ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success(editingId !== null ? "Expense updated" : "Expense logged");
      setSheetOpen(false);
      refreshExpenses();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to save expense");
    }
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const colSpan = isAdmin ? 9 : 8;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Expenses</h1>
          <p className="text-sm text-muted-foreground">Log daily operational costs.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="size-4" />
          Log Expense
        </Button>
      </div>

      {/* Date filter + total */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">From</Label>
          <Input
            type="date"
            className="w-36"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">To</Label>
          <Input type="date" className="w-36" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {expenses.length > 0 && (
          <span className="ml-auto text-sm font-medium">Total: ৳{total.toFixed(2)}</span>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Partner</TableHead>}
              <TableHead>Category</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Date</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-muted-foreground py-10">
                  Loading…
                </TableCell>
              </TableRow>
            ) : expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-muted-foreground py-10">
                  No expenses
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((e) => (
                <TableRow key={e.id}>
                  {isAdmin && <TableCell>{e.partner_name ?? "—"}</TableCell>}
                  <TableCell className="font-medium">{e.category_name ?? "—"}</TableCell>
                  <TableCell>{e.product_name ?? "—"}</TableCell>
                  <TableCell>{e.area_name ?? "—"}</TableCell>
                  <TableCell>৳{Number(e.amount).toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">{e.payment_method ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[160px] truncate">
                    {e.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(e.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => openEdit(e)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => deleteExpense(e.id)}
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
            <SheetTitle>{editingId !== null ? "Edit Expense" : "Log Expense"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5 px-4 pb-8">
            <Field
              label="Category"
              error={
                (form.formState.errors as Record<string, { message?: string }>).category_id?.message
              }
            >
              <Select
                value={categoryId ? String(categoryId) : ""}
                onValueChange={(v) =>
                  form.setValue("category_id", Number(v), { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category">
                    {selectedCategoryName ?? undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Product (optional)">
              <Select
                value={productId ? String(productId) : "none"}
                onValueChange={(v) => form.setValue("product_id", v === "none" ? null : Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No product">
                    {productId ? selectedProductName : "No product"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No product</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Area (optional)">
              <Select
                value={areaId ? String(areaId) : "none"}
                onValueChange={(v) => form.setValue("area_id", v === "none" ? null : Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No area">
                    {areaId ? selectedAreaName : "No area"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No area</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Amount (৳)" error={form.formState.errors.amount?.message}>
              <Input
                type="number"
                step="0.01"
                {...form.register("amount", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Payment Method">
              <Input placeholder="Cash, bKash…" {...form.register("payment_method")} />
            </Field>

            <Field label="Description">
              <Textarea
                placeholder="What was this expense for?"
                {...form.register("description")}
              />
            </Field>

            <Field label="Date" error={form.formState.errors.date?.message}>
              <Input type="date" {...form.register("date")} />
            </Field>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-1/2">
                {form.formState.isSubmitting
                  ? "Saving…"
                  : editingId !== null
                    ? "Update"
                    : "Log Expense"}
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
