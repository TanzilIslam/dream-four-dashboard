"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, CheckCircle2, RotateCcw, Trash2 } from "lucide-react";

import { createTaskSchema, type CreateTaskInput } from "@/lib/schemas/task";
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

type Task = {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: "low" | "normal" | "high";
  type: "one_time" | "daily";
  status: "pending" | "completed";
  completed_at: string | null;
  note: string | null;
  assigned_to: number;
  assigned_to_name: string | null;
  created_by_name: string | null;
};

type Partner = { id: number; name: string };

const PRIORITY_COLORS = {
  high: "bg-red-100 text-red-700",
  normal: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [createOpen, setCreateOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<Task | null>(null);
  const [completeNote, setCompleteNote] = useState("");
  const [completing, setCompleting] = useState(false);

  const form = useForm<CreateTaskInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createTaskSchema) as any,
    defaultValues: {
      assigned_to: 0,
      title: "",
      description: "",
      due_date: new Date().toISOString().slice(0, 10),
      priority: "normal",
      type: "one_time",
    },
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        setIsAdmin(data.user?.role === "admin");
        setUserId(data.user?.id ?? null);
      })
      .catch(() => setIsAdmin(false));

    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPartners((data as (Partner & { role: string })[]).filter((u) => u.role === "partner"));
        }
      });
  }, []);

  useEffect(() => {
    fetch(`/api/tasks?status=${statusFilter}`)
      .then((res) => res.json())
      .then((data) => {
        setTasks(data);
        setLoading(false);
      });
  }, [statusFilter]);

  async function refreshTasks() {
    const res = await fetch(`/api/tasks?status=${statusFilter}`);
    setTasks(await res.json());
  }

  async function onSubmit(data: CreateTaskInput) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Task created");
      setCreateOpen(false);
      form.reset();
      refreshTasks();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed to create task");
    }
  }

  async function handleComplete() {
    if (!completeTarget) return;
    setCompleting(true);
    const res = await fetch(`/api/tasks/${completeTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", note: completeNote }),
    });
    if (res.ok) {
      toast.success("Task marked complete");
      setCompleteTarget(null);
      setCompleteNote("");
      refreshTasks();
    } else {
      const json = await res.json();
      toast.error(json.error ?? "Failed");
    }
    setCompleting(false);
  }

  async function handleReopen(id: number) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen" }),
    });
    if (res.ok) {
      toast.success("Task reopened");
      refreshTasks();
    } else toast.error("Failed to reopen");
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Task deleted");
      refreshTasks();
    } else toast.error("Failed to delete");
  }

  const assigneeValue = useWatch({ control: form.control, name: "assigned_to", defaultValue: 0 });
  const priorityValue = useWatch({
    control: form.control,
    name: "priority",
    defaultValue: "normal",
  });
  const typeValue = useWatch({ control: form.control, name: "type", defaultValue: "one_time" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">Assign and track partner tasks.</p>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => {
              form.reset({
                assigned_to: 0,
                title: "",
                description: "",
                due_date: new Date().toISOString().slice(0, 10),
                priority: "normal",
                type: "one_time",
              });
              setCreateOpen(true);
            }}
          >
            <PlusIcon className="size-4" />
            New Task
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Status:</Label>
        <Select value={statusFilter} onValueChange={(v) => v != null && setStatusFilter(v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Assignee</TableHead>}
              <TableHead>Task</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 6 : 5}
                  className="text-center text-muted-foreground py-10"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : tasks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 6 : 5}
                  className="text-center text-muted-foreground py-10"
                >
                  No tasks
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((t) => (
                <TableRow key={t.id} className={t.status === "completed" ? "opacity-60" : ""}>
                  {isAdmin && (
                    <TableCell className="text-sm">{t.assigned_to_name ?? "—"}</TableCell>
                  )}
                  <TableCell>
                    <p className="font-medium">{t.title}</p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-[240px] truncate">
                        {t.description}
                      </p>
                    )}
                    {t.note && <p className="text-xs text-green-700 mt-0.5 italic">✓ {t.note}</p>}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[t.priority]}`}
                    >
                      {t.priority}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.status === "completed" ? "default" : "secondary"}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {t.status === "pending" && (userId === t.assigned_to || isAdmin) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-green-600 hover:bg-green-50"
                          title="Mark complete"
                          onClick={() => {
                            setCompleteNote("");
                            setCompleteTarget(t);
                          }}
                        >
                          <CheckCircle2 className="size-3.5" />
                        </Button>
                      )}
                      {t.status === "completed" && isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title="Reopen"
                          onClick={() => handleReopen(t.id)}
                        >
                          <RotateCcw className="size-3.5" />
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:bg-red-50"
                          title="Delete"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 className="size-3.5" />
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

      {/* Create task sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Task</SheetTitle>
          </SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5 px-4 pb-8">
            <Field
              label="Assign To"
              error={
                (form.formState.errors as Record<string, { message?: string }>).assigned_to?.message
              }
            >
              <Select
                value={assigneeValue ? String(assigneeValue) : ""}
                onValueChange={(v) =>
                  form.setValue("assigned_to", Number(v), { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Title" error={form.formState.errors.title?.message}>
              <Input placeholder="Task title…" {...form.register("title")} />
            </Field>

            <Field label="Description">
              <Textarea placeholder="Details…" {...form.register("description")} />
            </Field>

            <Field label="Due Date">
              <Input type="date" {...form.register("due_date")} />
            </Field>

            <Field label="Priority">
              <Select
                value={priorityValue}
                onValueChange={(v) =>
                  v != null && form.setValue("priority", v as "low" | "normal" | "high")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Type">
              <Select
                value={typeValue}
                onValueChange={(v) => v != null && form.setValue("type", v as "one_time" | "daily")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-1/2">
                {form.formState.isSubmitting ? "Creating…" : "Create"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="w-1/2"
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Complete task sheet */}
      <Sheet
        open={completeTarget !== null}
        onOpenChange={(open) => !open && setCompleteTarget(null)}
      >
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Mark as Complete</SheetTitle>
          </SheetHeader>
          {completeTarget && (
            <div className="px-4 pt-3 text-sm text-muted-foreground">{completeTarget.title}</div>
          )}
          <div className="mt-4 space-y-5 px-4 pb-8">
            <Field label="Completion Note (optional)">
              <Textarea
                placeholder="What was done?"
                value={completeNote}
                onChange={(e) => setCompleteNote(e.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button onClick={handleComplete} disabled={completing} className="w-1/2">
                {completing ? "Saving…" : "Complete"}
              </Button>
              <Button variant="outline" onClick={() => setCompleteTarget(null)} className="w-1/2">
                Cancel
              </Button>
            </div>
          </div>
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
