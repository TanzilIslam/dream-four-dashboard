"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { paymentConfigSchema, type PaymentConfigInput } from "@/lib/schemas/payment-config";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function PaymentConfigInner() {
  const [loading, setLoading] = useState(true);

  const form = useForm<z.input<typeof paymentConfigSchema>, unknown, PaymentConfigInput>({
    resolver: zodResolver(paymentConfigSchema),
    defaultValues: {
      due_allowed: true,
      max_due_per_customer: 1000,
      late_punch_threshold: "09:30",
      low_stock_default: 100,
    },
  });
  const dueAllowed = useWatch({ control: form.control, name: "due_allowed", defaultValue: true });

  useEffect(() => {
    fetch("/api/settings/payment-config")
      .then((res) => res.json())
      .then((c) => {
        form.reset({
          due_allowed: c.due_allowed,
          max_due_per_customer: Number(c.max_due_per_customer),
          // Postgres TIME comes back as HH:MM:SS — trim to HH:MM for the input.
          late_punch_threshold:
            typeof c.late_punch_threshold === "string"
              ? c.late_punch_threshold.slice(0, 5)
              : "09:30",
          low_stock_default: c.low_stock_default,
        });
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(data: PaymentConfigInput) {
    const res = await fetch("/api/settings/payment-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Settings saved");
    } else {
      toast.error("Please fix the errors");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Payment Config</h1>
        <p className="text-sm text-muted-foreground">
          Global business rules applied across all partners.
        </p>
      </div>

      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>Global Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Due Allowed</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Can customers carry an outstanding balance?
                  </p>
                </div>
                <Switch
                  checked={dueAllowed}
                  onCheckedChange={(v) => form.setValue("due_allowed", v)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Max Due Per Customer (৳)</Label>
                <Input type="number" step="0.01" {...form.register("max_due_per_customer")} />
                {form.formState.errors.max_due_per_customer && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.max_due_per_customer.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Late Punch Threshold</Label>
                <Input type="time" {...form.register("late_punch_threshold")} />
                <p className="text-xs text-muted-foreground">
                  A partner is late if they punch in after this time.
                </p>
                {form.formState.errors.late_punch_threshold && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.late_punch_threshold.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Low Stock Default</Label>
                <Input type="number" {...form.register("low_stock_default")} />
                <p className="text-xs text-muted-foreground">
                  Fallback alert threshold for products without their own.
                </p>
                {form.formState.errors.low_stock_default && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.low_stock_default.message}
                  </p>
                )}
              </div>

              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save Settings"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentConfigPage() {
  return (
    <AdminGuard>
      <PaymentConfigInner />
    </AdminGuard>
  );
}
