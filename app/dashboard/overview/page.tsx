"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Phone, Calendar } from "lucide-react";

import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type KpiRow = {
  eggs_sold: string;
  cash_in: string;
  new_due: string;
  expenses: string;
  net_profit: string;
};

type AdminData = {
  kpi: {
    today: KpiRow;
    yesterday: KpiRow;
    allTime: KpiRow;
  };
  stock: {
    id: number;
    name: string;
    unit: string;
    low_stock_threshold: number;
    purchased_qty: string;
    delivered_qty: string;
    reserved_qty: string;
    returned_qty: string;
    available_qty: string;
  }[];
  assets: {
    asset_id: number;
    product_id: number;
    asset_name: string;
    sent: number;
    returned_by_customers: number;
    returned_to_suppliers: number;
    unreturned: number;
  }[];
  partners: {
    id: number;
    name: string;
    eggs_delivered: string;
    cash_collected: string;
    expenses: string;
    punch_in_at: string | null;
  }[];
  pending: {
    purchase_requests: string;
    remittances: string;
    reports: string;
  };
  dues: {
    summary: { debtor_count: string; total_due: string };
    topDebtors: { name: string; total_due: string }[];
  };
};

type PartnerStatsRow = {
  eggs_delivered: string;
  cash_collected: string;
  due_added: string;
  expenses: string;
  pending_tasks: string;
  completed_tasks: string;
};

type PartnerData = {
  stats: PartnerStatsRow;
  allTimeStats: PartnerStatsRow;
};

type Reminder = {
  callToday: {
    id: number;
    name: string;
    phone: string | null;
    area_name: string | null;
    outstanding_due: string;
  }[];
  paymentsDue: {
    order_id: number;
    customer_name: string;
    customer_phone: string | null;
    promised_payment_date: string;
    due_amount: string;
  }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delta(today: number, yesterday: number) {
  if (yesterday === 0) return null;
  return ((today - yesterday) / yesterday) * 100;
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  if (Math.abs(pct) < 0.5) return <Minus className="size-3 text-muted-foreground" />;
  if (pct > 0)
    return (
      <span className="flex items-center gap-0.5 text-xs text-green-600">
        <TrendingUp className="size-3" />
        {pct.toFixed(0)}%
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-xs text-red-500">
      <TrendingDown className="size-3" />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  yesterday,
  prefix = "",
}: {
  label: string;
  value: number;
  yesterday?: number;
  prefix?: string;
}) {
  const pct = yesterday !== undefined ? delta(value, yesterday) : null;
  return (
    <div className="rounded-lg border border-border p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">
        {prefix}
        {value.toLocaleString()}
      </p>
      {yesterday !== undefined && (
        <div className="flex items-center gap-1">
          <DeltaBadge pct={pct} />
          <span className="text-xs text-muted-foreground">vs yesterday</span>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [partnerData, setPartnerData] = useState<PartnerData | null>(null);
  const [reminders, setReminders] = useState<Reminder | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        const admin = data.user?.role === "admin";
        setIsAdmin(admin);
        if (!admin) {
          fetch("/api/analytics/overview")
            .then((r) => r.json())
            .then(setPartnerData);
          fetch("/api/analytics/reminders")
            .then((r) => r.json())
            .then(setReminders);
        }
      })
      .catch(() => setIsAdmin(false));
  }, []);

  if (isAdmin === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!isAdmin) return <PartnerDashboard data={partnerData} reminders={reminders} />;
  return <AdminDashboard />;
}

// ─── Partner Dashboard ────────────────────────────────────────────────────────

function PartnerDashboard({
  data,
  reminders,
}: {
  data: PartnerData | null;
  reminders: Reminder | null;
}) {
  const [viewMode, setViewMode] = useState<"today" | "alltime">("today");

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const s = viewMode === "today" ? data?.stats : data?.allTimeStats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">My Dashboard</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      {/* Quick stats */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {viewMode === "today" ? "Today" : "All Time"}
        </h2>
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Eggs Delivered" value={s ? String(s.eggs_delivered) : "—"} />
        <StatCard
          label="Cash Collected"
          value={s ? `৳${Number(s.cash_collected).toFixed(2)}` : "—"}
        />
        <StatCard label="Due Added" value={s ? `৳${Number(s.due_added).toFixed(2)}` : "—"} />
        <StatCard label="Expenses" value={s ? `৳${Number(s.expenses).toFixed(2)}` : "—"} />
        <StatCard
          label="Tasks"
          value={
            s
              ? `${s.completed_tasks} / ${Number(s.completed_tasks) + Number(s.pending_tasks)}`
              : "—"
          }
        />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "New Order", href: "/dashboard/orders" },
          { label: "Record Punch", href: "/dashboard/attendance" },
          { label: "Log Expense", href: "/dashboard/expenses" },
          { label: "Daily Report", href: "/dashboard/daily-reports" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {a.label}
          </Link>
        ))}
      </div>

      {/* Call today */}
      {reminders && reminders.callToday.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Calendar className="size-4 text-blue-500" />
            Deliver Today ({reminders.callToday.length})
          </h2>
          <div className="rounded-lg border border-border divide-y divide-border">
            {reminders.callToday.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.area_name ?? "—"}</p>
                </div>
                <div className="flex items-center gap-3">
                  {Number(c.outstanding_due) > 0 && (
                    <span className="text-xs font-medium text-red-600">
                      Due: ৳{Number(c.outstanding_due).toFixed(0)}
                    </span>
                  )}
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <Phone className="size-3" />
                      {c.phone}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Payment promises overdue */}
      {reminders && reminders.paymentsDue.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <AlertTriangle className="size-4 text-orange-500" />
            Payment Promises Overdue ({reminders.paymentsDue.length})
          </h2>
          <div className="rounded-lg border border-border divide-y divide-border">
            {reminders.paymentsDue.map((p) => (
              <div key={p.order_id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{p.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Promised: {new Date(p.promised_payment_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-red-600">
                    ৳{Number(p.due_amount).toFixed(2)}
                  </span>
                  {p.customer_phone && (
                    <a
                      href={`tel:${p.customer_phone}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      <Phone className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function ViewToggle({
  value,
  onChange,
}: {
  value: "today" | "alltime";
  onChange: (v: "today" | "alltime") => void;
}) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden text-xs font-medium">
      <button
        onClick={() => onChange("today")}
        className={`px-3 py-1 transition-colors ${
          value === "today"
            ? "bg-foreground text-background"
            : "bg-background text-muted-foreground hover:text-foreground"
        }`}
      >
        Today
      </button>
      <button
        onClick={() => onChange("alltime")}
        className={`px-3 py-1 transition-colors ${
          value === "alltime"
            ? "bg-foreground text-background"
            : "bg-background text-muted-foreground hover:text-foreground"
        }`}
      >
        All Time
      </button>
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"today" | "alltime">("today");

  // Fetch products once on mount, default to first
  useEffect(() => {
    fetch("/api/settings/products")
      .then((r) => r.json())
      .then((ps: { id: number; name: string }[]) => {
        setProducts(ps);
        if (ps.length > 0) setSelectedProductId(ps[0].id);
      });
  }, []);

  // Fetch overview whenever selected product changes
  useEffect(() => {
    if (selectedProductId === null) return;
    fetch(`/api/analytics/overview?product_id=${selectedProductId}`)
      .then((r) => r.json())
      .then(setData);
  }, [selectedProductId]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  if (!data || products.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const t = data.kpi.today;
  const y = data.kpi.yesterday;
  const at = data.kpi.allTime;

  const pendingCount = Number(data.pending.remittances) + Number(data.pending.reports);

  const selectedProductName = products.find((p) => p.id === selectedProductId)?.name ?? "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      {/* Product selector */}
      <section className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Product
        </p>
        <div className="flex flex-wrap gap-1.5">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProductId(p.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                selectedProductId === p.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      {/* KPI cards */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {selectedProductName} — {viewMode === "today" ? "Today" : "All Time"}
          </h2>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {viewMode === "today" ? (
            <>
              <KpiCard
                label="Eggs Sold"
                value={Number(t.eggs_sold)}
                yesterday={Number(y.eggs_sold)}
              />
              <KpiCard
                label="Cash In"
                prefix="৳"
                value={Number(t.cash_in)}
                yesterday={Number(y.cash_in)}
              />
              <KpiCard
                label="New Due"
                prefix="৳"
                value={Number(t.new_due)}
                yesterday={Number(y.new_due)}
              />
              <KpiCard
                label="Expenses"
                prefix="৳"
                value={Number(t.expenses)}
                yesterday={Number(y.expenses)}
              />
              <KpiCard
                label="Net Profit"
                prefix="৳"
                value={Number(t.net_profit)}
                yesterday={Number(y.net_profit)}
              />
            </>
          ) : (
            <>
              <KpiCard label="Eggs Sold" value={Number(at.eggs_sold)} />
              <KpiCard label="Cash In" prefix="৳" value={Number(at.cash_in)} />
              <KpiCard label="Total Due Added" prefix="৳" value={Number(at.new_due)} />
              <KpiCard label="Expenses" prefix="৳" value={Number(at.expenses)} />
              <KpiCard label="Net Profit" prefix="৳" value={Number(at.net_profit)} />
            </>
          )}
        </div>
      </section>

      {/* Pending actions alert */}
      {pendingCount > 0 && (
        <section className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-orange-800 flex items-center gap-1.5">
            <AlertTriangle className="size-4" />
            Pending Actions ({pendingCount})
          </h2>
          <div className="flex flex-wrap gap-2">
            {Number(data.pending.remittances) > 0 && (
              <Link href="/dashboard/cash-remittances">
                <Badge variant="secondary">{data.pending.remittances} Remittance(s)</Badge>
              </Link>
            )}
            {Number(data.pending.reports) > 0 && (
              <Link href="/dashboard/daily-reports">
                <Badge variant="secondary">{data.pending.reports} Report(s) to Review</Badge>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Stock + Assets */}
      <section className="space-y-2 md:w-1/2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Stock
        </h2>
        <div className="rounded-lg border border-border divide-y divide-border">
          {data.stock
            .filter((p) => p.id === selectedProductId)
            .map((p) => {
              const available = Number(p.available_qty);
              const low = available <= p.low_stock_threshold;
              const productAssets = data.assets.filter((a) => a.product_id === p.id);
              return (
                <div key={p.id}>
                  {/* Product stock row */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.unit}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${low ? "text-red-600" : ""}`}>
                        {available.toLocaleString()}
                      </p>
                      {low && (
                        <p className="text-xs text-red-500 flex items-center gap-0.5 justify-end">
                          <AlertTriangle className="size-3" /> Low stock
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Asset rows under this product */}
                  {productAssets.map((a) => (
                    <div
                      key={a.asset_id}
                      className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t border-border"
                    >
                      <div className="pl-3">
                        <p className="text-xs font-medium text-muted-foreground">{a.asset_name}</p>
                        <p className="text-[11px] text-muted-foreground/70">
                          Sent {a.sent} · Returned {a.returned_by_customers}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-bold ${a.unreturned > 0 ? "text-amber-600" : "text-muted-foreground"}`}
                        >
                          {a.unreturned.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70">unreturned</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          {data.stock.filter((p) => p.id === selectedProductId).length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No products</p>
          )}
        </div>
      </section>
    </div>
  );
}
