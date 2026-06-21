"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Pencil, Trash2 } from "lucide-react";

import { expenseCategorySchema, type ExpenseCategoryInput } from "@/lib/schemas/expense-category";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Category = { id: number; name: string; icon: string | null };
type Mode = "create" | "edit";

function ExpenseCategoriesInner() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);

  const form = useForm<z.input<typeof expenseCategorySchema>, unknown, ExpenseCategoryInput>({
    resolver: zodResolver(expenseCategorySchema),
    defaultValues: { name: "", icon: "" },
  });

  async function fetchCategories() {
    const res = await fetch("/api/settings/expense-categories");
    setCategories(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/settings/expense-categories")
      .then((res) => res.json())
      .then((data) => {
        setCategories(data);
        setLoading(false);
      });
  }, []);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    form.reset({ name: "", icon: "" });
    setSheetOpen(true);
  }

  function openEdit(c: Category) {
    setMode("edit");
    setEditingId(c.id);
    form.reset({ name: c.name, icon: c.icon ?? "" });
    setSheetOpen(true);
  }

  async function onSubmit(data: ExpenseCategoryInput) {
    const url = mode === "create" ? "/api/settings/expense-categories" : `/api/settings/expense-categories/${editingId}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success(mode === "create" ? "Category added" : "Category updated");
      setSheetOpen(false);
      fetchCategories();
    } else {
      toast.error("Please fix the errors");
    }
  }

  async function handleDelete(c: Category) {
    const res = await fetch(`/api/settings/expense-categories/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Category deleted");
      fetchCategories();
    } else {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Expense Categories</h1>
          <p className="text-sm text-muted-foreground">Labels partners pick when logging expenses.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="size-4" />
          Add Category
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Icon</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                  Loading…
                </TableCell>
              </TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                  No categories yet
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-lg">{c.icon || "—"}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="size-7 hover:bg-muted">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(c)}
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
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{mode === "create" ? "Add Category" : "Edit Category"}</SheetTitle>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5 px-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="Fuel" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Icon (emoji or short label)</Label>
              <Input placeholder="⛽" {...form.register("icon")} />
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

export default function ExpenseCategoriesPage() {
  return (
    <AdminGuard>
      <ExpenseCategoriesInner />
    </AdminGuard>
  );
}
