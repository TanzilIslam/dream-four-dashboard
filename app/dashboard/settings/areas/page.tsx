"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Pencil, Power, X } from "lucide-react";

import { areaSchema, type AreaInput } from "@/lib/schemas/area";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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

type Area = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  assigned_partner_id: number | null;
  assigned_partner_name: string | null;
};

type Member = { id: number; user_id: number; name: string; email: string };
type Partner = { id: number; name: string; role: string };

type Mode = "create" | "edit";

function AreasInner() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const form = useForm<z.input<typeof areaSchema>, unknown, AreaInput>({
    resolver: zodResolver(areaSchema),
    defaultValues: { name: "", description: "", is_active: true },
  });
  const isActive = form.watch("is_active");

  async function fetchAreas() {
    const res = await fetch(`/api/settings/areas${showAll ? "?all=true" : ""}`);
    setAreas(await res.json());
    setLoading(false);
  }

  async function fetchPartners() {
    const res = await fetch("/api/users");
    const users = (await res.json()) as Partner[];
    setPartners(users.filter((u) => u.role !== "admin"));
  }

  useEffect(() => {
    fetchAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

  useEffect(() => {
    fetchPartners();
  }, []);

  async function fetchMembers(areaId: number) {
    const res = await fetch(`/api/settings/areas/${areaId}/members`);
    setMembers(await res.json());
  }

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setMembers([]);
    setSelectedPartner("");
    form.reset({ name: "", description: "", is_active: true });
    setSheetOpen(true);
  }

  function openEdit(a: Area) {
    setMode("edit");
    setEditingId(a.id);
    setSelectedPartner("");
    form.reset({ name: a.name, description: a.description ?? "", is_active: a.is_active });
    fetchMembers(a.id);
    setSheetOpen(true);
  }

  async function onSubmit(data: AreaInput) {
    const url = mode === "create" ? "/api/settings/areas" : `/api/settings/areas/${editingId}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const saved = await res.json();
      toast.success(mode === "create" ? "Area added" : "Area updated");
      fetchAreas();
      if (mode === "create") {
        // Move into edit mode so the partner can be assigned right away.
        setMode("edit");
        setEditingId(saved.id);
        fetchMembers(saved.id);
      } else {
        setSheetOpen(false);
      }
    } else {
      toast.error("Please fix the errors");
    }
  }

  async function handleAssign() {
    if (!editingId || !selectedPartner) return;
    setAssigning(true);
    const res = await fetch(`/api/settings/areas/${editingId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: Number(selectedPartner) }),
    });
    if (res.ok) {
      toast.success("Partner assigned");
      setSelectedPartner("");
      fetchMembers(editingId);
      fetchAreas();
    } else {
      toast.error("Failed to assign partner");
    }
    setAssigning(false);
  }

  async function handleRemove(userId: number) {
    if (!editingId) return;
    const res = await fetch(`/api/settings/areas/${editingId}/members/${userId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Partner removed");
      fetchMembers(editingId);
      fetchAreas();
    } else {
      toast.error("Failed to remove partner");
    }
  }

  async function handleDeactivate(a: Area) {
    const res = await fetch(`/api/settings/areas/${a.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Area deactivated");
      fetchAreas();
    } else {
      toast.error("Failed to deactivate");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Areas</h1>
          <p className="text-sm text-muted-foreground">Delivery territories and partner assignment.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showAll} onCheckedChange={setShowAll} />
            Show inactive
          </label>
          <Button size="sm" onClick={openCreate}>
            <PlusIcon className="size-4" />
            Add Area
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Assigned Partner</TableHead>
              <TableHead>Active</TableHead>
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
            ) : areas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  No areas yet
                </TableCell>
              </TableRow>
            ) : (
              areas.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-muted-foreground">{a.description ?? "—"}</TableCell>
                  <TableCell>
                    {a.assigned_partner_name ? (
                      <Badge variant="secondary">{a.assigned_partner_name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.is_active ? "default" : "secondary"}>
                      {a.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)} className="size-7 hover:bg-muted">
                        <Pencil className="size-3.5" />
                      </Button>
                      {a.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeactivate(a)}
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
            <SheetTitle>{mode === "create" ? "Add Area" : "Edit Area"}</SheetTitle>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5 px-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="Mirpur" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea {...form.register("description")} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={isActive} onCheckedChange={(v) => form.setValue("is_active", v)} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-1/2">
                {form.formState.isSubmitting ? "Saving…" : mode === "create" ? "Create" : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} className="w-1/2">
                {mode === "create" ? "Cancel" : "Close"}
              </Button>
            </div>
          </form>

          {mode === "edit" && (
            <div className="mt-6 px-4 pb-8">
              <Separator className="mb-5" />
              <h3 className="text-sm font-semibold">Partner Assignment</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Only one partner can be active in an area at a time. Assigning a new partner replaces the current one.
              </p>

              <div className="mt-4 space-y-2">
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No partner assigned.</p>
                ) : (
                  members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(m.user_id)}
                        className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label>Assign Partner</Label>
                  <Select value={selectedPartner} onValueChange={(v) => setSelectedPartner(v ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select partner" />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No partners available</div>
                      ) : (
                        partners.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" onClick={handleAssign} disabled={!selectedPartner || assigning}>
                  Assign
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function AreasPage() {
  return (
    <AdminGuard>
      <AreasInner />
    </AdminGuard>
  );
}
