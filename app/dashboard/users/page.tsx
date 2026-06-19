"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Pencil, Trash2, LogIn } from "lucide-react";

import { createUserSchema, updateUserSchema, type CreateUserInput, type UpdateUserInput } from "@/lib/schemas/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  created_at: string;
};

type Mode = "create" | "edit";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<number | null>(null);
  const router = useRouter();

  async function handleImpersonate(id: number) {
    setImpersonatingId(id);
    const res = await fetch("/api/auth/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      toast.success("Switched account");
      router.push("/dashboard/overview");
    } else {
      toast.error("Failed to switch account");
    }
    setImpersonatingId(null);
  }

  const createForm = useForm<CreateUserInput>({ resolver: zodResolver(createUserSchema) });
  const editForm = useForm<UpdateUserInput>({ resolver: zodResolver(updateUserSchema) });

  const activeForm = mode === "create" ? createForm : editForm;

  async function fetchUsers() {
    const res = await fetch("/api/users");
    setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, []);

  function openCreate() {
    setMode("create");
    setEditingUser(null);
    createForm.reset({ name: "", email: "", password: "", role: "user" });
    setSheetOpen(true);
  }

  function openEdit(user: User) {
    setMode("edit");
    setEditingUser(user);
    editForm.reset({ name: user.name, email: user.email, password: "", role: user.role });
    setSheetOpen(true);
  }

  async function onSubmit(data: CreateUserInput | UpdateUserInput) {
    const url = mode === "create" ? "/api/users" : `/api/users/${editingUser!.id}`;
    const method = mode === "create" ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      toast.success(mode === "create" ? "User created" : "User updated");
      setSheetOpen(false);
      fetchUsers();
    } else {
      const json = await res.json();
      const errors = json.error as Record<string, string[]>;
      Object.entries(errors).forEach(([field, messages]) => {
        activeForm.setError(field as never, { message: messages[0] });
      });
      toast.error("Please fix the errors");
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("User deleted");
      fetchUsers();
    } else {
      toast.error("Failed to delete user");
    }
    setDeletingId(null);
  }

  const form = mode === "create" ? createForm : editForm;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="size-4" />
          Add User
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  Loading...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name ?? "—"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {user.role !== "admin" && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={impersonatingId === user.id}
                          onClick={() => handleImpersonate(user.id)}
                          className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <LogIn className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(user)}
                          className="size-7 hover:bg-muted"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deletingId === user.id}
                          onClick={() => handleDelete(user.id)}
                          className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Right Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{mode === "create" ? "Add User" : "Edit User"}</SheetTitle>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5 px-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="John Doe" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="john@example.com" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">
                Password {mode === "edit" && <span className="text-muted-foreground text-xs">(leave blank to keep current)</span>}
              </Label>
              <Input id="password" type="password" placeholder="••••••••" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                defaultValue={mode === "edit" ? editingUser?.role : "user"}
                onValueChange={(val) => form.setValue("role", val as "admin" | "user")}
              >

                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.role && (
                <p className="text-xs text-destructive">{form.formState.errors.role.message}</p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-1/2">
                {form.formState.isSubmitting ? "Saving..." : mode === "create" ? "Create" : "Save changes"}
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
