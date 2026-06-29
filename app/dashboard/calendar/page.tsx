"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
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

type Product = { id: number; name: string; unit: string };

type StockRow = {
  product_id: number;
  product_name: string;
  unit: string;
  opening_stock: string;
  stock_in: string;
  stock_out: string;
  returns_in: string;
  adjustments: string;
};

type PurchaseRow = {
  id: number;
  supplier_name: string | null;
  product_name: string | null;
  product_unit: string | null;
  actual_qty: string;
  actual_price: string;
  actual_total: string;
  paid: string;
  due: string;
  note: string | null;
};

type OrderRow = {
  id: number;
  customer_name: string | null;
  product_name: string | null;
  product_unit: string | null;
  area_name: string | null;
  quantity: number;
  unit_price: string;
  total_amount: string;
  paid_amount: string;
  due_amount: string;
  status: string;
};

type DayData = {
  stock: StockRow[];
  purchases: PurchaseRow[];
  orders: OrderRow[];
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  delivered: "default",
  paid: "outline",
  cancelled: "destructive",
};

function fmt(n: string | number) {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function CalendarPage() {
  const [selected, setSelected] = useState<Date | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"stock" | "purchases" | "orders">("stock");

  const [products, setProducts] = useState<Product[]>([]);
  const [productFilter, setProductFilter] = useState("all");
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(false);

  // Load products once
  useEffect(() => {
    fetch("/api/stock")
      .then((r) => r.json())
      .then((data: Product[]) => setProducts(data));
  }, []);

  // Fetch day data when date or product changes
  useEffect(() => {
    if (!selected || !sheetOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setDayData(null);
    const dateStr = selected.toISOString().slice(0, 10);
    fetch(`/api/calendar/day?date=${dateStr}&product_id=${productFilter}`)
      .then((r) => r.json())
      .then((data) => setDayData(data))
      .finally(() => setLoading(false));
  }, [selected, sheetOpen, productFilter]);

  function handleSelect(date: Date | undefined) {
    setSelected(date);
    if (date) {
      setSheetOpen(true);
      setActiveTab("stock");
    }
  }

  // Derived totals
  const purchaseTotal = dayData?.purchases.reduce((s, r) => s + Number(r.actual_total), 0) ?? 0;
  const purchasePaid = dayData?.purchases.reduce((s, r) => s + Number(r.paid), 0) ?? 0;
  const purchaseDue = dayData?.purchases.reduce((s, r) => s + Number(r.due), 0) ?? 0;

  const orderTotal = dayData?.orders.reduce((s, r) => s + Number(r.total_amount), 0) ?? 0;
  const orderPaid = dayData?.orders.reduce((s, r) => s + Number(r.paid_amount), 0) ?? 0;
  const orderDue = dayData?.orders.reduce((s, r) => s + Number(r.due_amount), 0) ?? 0;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">Calendar</h1>
        <span className="text-sm text-muted-foreground">Click any date to view details</span>
      </div>

      {/* Calendar */}
      <div className="rounded-xl border border-border bg-card shadow-sm w-fit overflow-hidden">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          className="p-0"
          classNames={{
            months: "relative flex flex-col",
            month: "flex flex-col",
            month_caption: "flex justify-center items-center py-2.5 px-4 border-b border-border",
            caption_label: "text-sm font-semibold",
            nav: "absolute top-1.5 left-0 right-0 flex justify-between px-3 z-10 pointer-events-none",
            button_previous:
              "pointer-events-auto h-7 w-7 inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors opacity-70 hover:opacity-100",
            button_next:
              "pointer-events-auto h-7 w-7 inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors opacity-70 hover:opacity-100",
            month_grid: "table-fixed border-collapse",
            weekdays: "border-b border-border",
            weekday:
              "py-1.5 w-8 text-[11px] font-medium text-muted-foreground text-center uppercase tracking-wide",
            weeks: "",
            week: "border-b border-border last:border-0",
            day: "border-r border-border last:border-0 align-top p-0 w-8",
            day_button:
              "w-8 h-8 p-0 flex items-center justify-center font-normal text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer",
            selected: "bg-primary text-primary-foreground font-semibold rounded-none",
            today: "bg-primary/20 text-primary font-semibold",
            outside: "text-muted-foreground/40 bg-muted/20",
            disabled: "text-muted-foreground opacity-40",
            hidden: "invisible",
          }}
        />
      </div>

      {/* Day detail sidebar */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:!max-w-2xl md:!max-w-4xl overflow-y-auto flex flex-col">
          <SheetHeader className="shrink-0">
            <SheetTitle>
              {selected?.toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </SheetTitle>
          </SheetHeader>

          {/* Product filter */}
          <div className="px-4 pt-3 shrink-0">
            <Select value={productFilter} onValueChange={(v) => setProductFilter(v ?? "all")}>
              <SelectTrigger className="h-8 text-sm w-48">
                <SelectValue>
                  {productFilter === "all"
                    ? "All Products"
                    : (products.find((p) => String(p.id) === productFilter)?.name ??
                      "All Products")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <div className="px-4 pt-3 shrink-0">
            <div className="flex border-b border-border">
              {(["stock", "purchases", "orders"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                    activeTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                  {tab === "purchases" && dayData && dayData.purchases.length > 0 && (
                    <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                      {dayData.purchases.length}
                    </span>
                  )}
                  {tab === "orders" && dayData && dayData.orders.length > 0 && (
                    <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                      {dayData.orders.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !dayData ? null : (
              <>
                {/* ── Stock Tab ── */}
                {activeTab === "stock" && (
                  <div className="space-y-4">
                    {dayData.stock.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-10">
                        No stock data.
                      </p>
                    ) : (
                      dayData.stock.map((s) => {
                        const closing =
                          Number(s.opening_stock) +
                          Number(s.stock_in) -
                          Number(s.stock_out) +
                          Number(s.returns_in) +
                          Number(s.adjustments);
                        return (
                          <div key={s.product_id} className="space-y-2">
                            <p className="text-sm font-semibold">
                              {s.product_name}{" "}
                              <span className="font-normal text-muted-foreground">({s.unit})</span>
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              <SummaryCard
                                label="Opening"
                                value={Number(s.opening_stock).toLocaleString()}
                              />
                              <SummaryCard
                                label="Stock In"
                                value={`+${Number(s.stock_in).toLocaleString()}`}
                              />
                              <SummaryCard
                                label="Stock Out"
                                value={`-${Number(s.stock_out).toLocaleString()}`}
                              />
                              {Number(s.returns_in) !== 0 && (
                                <SummaryCard
                                  label="Returns In"
                                  value={`+${Number(s.returns_in).toLocaleString()}`}
                                />
                              )}
                              {Number(s.adjustments) !== 0 && (
                                <SummaryCard
                                  label="Adjustment"
                                  value={
                                    (Number(s.adjustments) > 0 ? "+" : "") +
                                    Number(s.adjustments).toLocaleString()
                                  }
                                />
                              )}
                              <SummaryCard label="Closing" value={closing.toLocaleString()} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* ── Purchases Tab ── */}
                {activeTab === "purchases" && (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-2">
                      <SummaryCard label="Total Purchased" value={`৳${fmt(purchaseTotal)}`} />
                      <SummaryCard label="Total Paid" value={`৳${fmt(purchasePaid)}`} />
                      <SummaryCard label="Total Due" value={`৳${fmt(purchaseDue)}`} />
                    </div>

                    {dayData.purchases.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No purchases on this date.
                      </p>
                    ) : (
                      <div className="rounded-lg border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Supplier</TableHead>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead className="text-right">Paid</TableHead>
                              <TableHead className="text-right">Due</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dayData.purchases.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell className="font-medium text-sm">
                                  {r.supplier_name ?? (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {r.product_name ?? "—"}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-sm">
                                  {Number(r.actual_qty).toLocaleString()} {r.product_unit}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-sm font-medium">
                                  ৳{fmt(r.actual_total)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-sm text-green-600">
                                  ৳{fmt(r.paid)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-sm text-destructive">
                                  {Number(r.due) > 0 ? (
                                    `৳${fmt(r.due)}`
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Orders Tab ── */}
                {activeTab === "orders" && (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-2">
                      <SummaryCard label="Orders" value={String(dayData.orders.length)} />
                      <SummaryCard label="Total Amount" value={`৳${fmt(orderTotal)}`} />
                      <SummaryCard label="Collected" value={`৳${fmt(orderPaid)}`} />
                      <SummaryCard label="Due" value={`৳${fmt(orderDue)}`} />
                    </div>

                    {dayData.orders.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No orders on this date.
                      </p>
                    ) : (
                      <div className="rounded-lg border border-border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Customer</TableHead>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-right">Rate</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="text-right">Paid</TableHead>
                              <TableHead className="text-right">Due</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dayData.orders.map((o) => (
                              <TableRow key={o.id}>
                                <TableCell className="font-medium text-sm whitespace-nowrap">
                                  {o.customer_name ?? "—"}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                  {o.product_name ?? "—"}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-sm">
                                  {o.quantity}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                                  ৳{fmt(o.unit_price)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-sm font-medium">
                                  ৳{fmt(o.total_amount)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-sm text-green-600">
                                  {Number(o.paid_amount) > 0 ? (
                                    `৳${fmt(o.paid_amount)}`
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-sm text-destructive">
                                  {Number(o.due_amount) > 0 ? (
                                    `৳${fmt(o.due_amount)}`
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={STATUS_VARIANT[o.status] ?? "secondary"}
                                    className="text-xs"
                                  >
                                    {o.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
