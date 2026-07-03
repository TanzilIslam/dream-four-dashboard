"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, EyeIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog } from "@base-ui/react/dialog";
import { toast } from "sonner";

type Product = { id: number; name: string };

const REPORT_SHEETS = [
  { key: "summary", label: "Summary KPIs" },
  { key: "customers", label: "Customer Performance" },
  { key: "dailyTrend", label: "Daily Sales Trend" },
  { key: "products", label: "Product Performance" },
  { key: "expenseBreakdown", label: "Expense Breakdown" },
  { key: "dues", label: "Outstanding Dues" },
  { key: "supplies", label: "Supply History" },
] as const;

type SheetKey = (typeof REPORT_SHEETS)[number]["key"];

const SHEET_LABELS: Record<SheetKey, string> = {
  summary: "Summary",
  customers: "Customer Performance",
  dailyTrend: "Daily Sales Trend",
  products: "Product Performance",
  expenseBreakdown: "Expense Breakdown",
  dues: "Outstanding Dues",
  supplies: "Supply History",
};

const DB_TABLES = [
  { key: "customers", label: "Customers" },
  { key: "orders", label: "Orders" },
  { key: "purchase_requests", label: "Purchase Requests" },
  { key: "expenses", label: "Expenses" },
  { key: "stock", label: "Stock" },
  { key: "areas", label: "Areas" },
  { key: "suppliers", label: "Suppliers" },
  { key: "products", label: "Products" },
];

type SheetData = { key: SheetKey; label: string; rows: Record<string, unknown>[] };

export default function ExportPage() {
  const [dbLoading, setDbLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedSheets, setSelectedSheets] = useState<Set<SheetKey>>(new Set());
  const [reportFormat, setReportFormat] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState<SheetData[]>([]);
  const [activeTab, setActiveTab] = useState<SheetKey | null>(null);

  function toggleSheet(key: SheetKey) {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  useEffect(() => {
    fetch("/api/settings/products")
      .then((r) => r.json())
      .then((data: Product[]) => setProducts(data));
  }, []);

  function buildParams() {
    const params = new URLSearchParams();
    if (productId !== "all") params.set("product_id", productId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params;
  }

  function buildSheets(data: Record<SheetKey, Record<string, unknown>[]>): SheetData[] {
    return REPORT_SHEETS.filter((s) => selectedSheets.has(s.key))
      .map((s) => ({ key: s.key, label: SHEET_LABELS[s.key], rows: data[s.key] ?? [] }))
      .filter((s) => s.rows.length > 0);
  }

  async function handleDbExport() {
    setDbLoading(true);
    try {
      const results = await Promise.all(
        DB_TABLES.map((t) =>
          fetch(`/api/backup?table=${t.key}`)
            .then((r) => (r.ok ? r.json() : []))
            .then((rows) => ({ label: t.label, rows }))
        )
      );
      const { utils, writeFile } = await import("xlsx");
      const wb = utils.book_new();
      for (const { label, rows } of results) {
        if (rows.length === 0) continue;
        const ws = utils.json_to_sheet(rows);
        utils.book_append_sheet(wb, ws, label);
      }
      writeFile(wb, `database-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Database exported");
    } catch {
      toast.error("Failed to export database");
    } finally {
      setDbLoading(false);
    }
  }

  async function handleReportExport() {
    setReportLoading(true);
    try {
      const res = await fetch(`/api/reports/executive?${buildParams()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();

      const sheets = buildSheets(data);
      const productName =
        productId === "all"
          ? "all-products"
          : (products.find((p) => String(p.id) === productId)?.name ?? "product");
      const period =
        from && to ? `${from}-to-${to}` : from ? `from-${from}` : to ? `to-${to}` : "all-time";
      const baseName = `report-${productName}-${period}`;

      if (reportFormat === "pdf") {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

        // jsPDF cannot render Bengali Unicode — replace ৳ with Tk
        const sanitize = (v: unknown) => String(v ?? "—").replace(/৳/g, "Tk");

        sheets.forEach(({ label, rows }, idx) => {
          if (idx > 0) doc.addPage();
          const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
          // Sanitize column headers too
          const headCols = cols.map(sanitize);
          doc.setFontSize(11);
          doc.text(label, 10, 12);
          autoTable(doc, {
            startY: 16,
            head: [headCols],
            body: rows.map((r) => cols.map((c) => sanitize(r[c]))),
            styles: { fontSize: 10, cellPadding: 2, overflow: "linebreak" },
            headStyles: {
              fillColor: [30, 30, 30],
              textColor: 255,
              fontStyle: "bold",
              cellPadding: 2.5,
            },
            alternateRowStyles: { fillColor: [247, 247, 247] },
            margin: { top: 10, left: 10, right: 10, bottom: 8 },
            tableWidth: "auto",
          });
        });

        doc.save(`${baseName}.pdf`);
      } else {
        const { utils, writeFile } = await import("xlsx");
        const wb = utils.book_new();
        for (const { label, rows } of sheets) {
          const ws = utils.json_to_sheet(rows);
          utils.book_append_sheet(wb, ws, label);
        }
        writeFile(wb, `${baseName}.xlsx`);
      }

      toast.success("Report downloaded");
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setReportLoading(false);
    }
  }

  async function handleReportView() {
    setViewLoading(true);
    try {
      const res = await fetch(`/api/reports/executive?${buildParams()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const sheets = buildSheets(data);
      if (sheets.length === 0) {
        toast.error("No data to display");
        return;
      }
      setViewData(sheets);
      setActiveTab(sheets[0].key);
      setViewOpen(true);
    } catch {
      toast.error("Failed to load report");
    } finally {
      setViewLoading(false);
    }
  }

  const canGenerate = selectedSheets.size > 0;
  const activeSheet = viewData.find((s) => s.key === activeTab);
  const columns =
    activeSheet && activeSheet.rows.length > 0 ? Object.keys(activeSheet.rows[0]) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Export</h1>
        <p className="text-sm text-muted-foreground">
          Download data exports and executive reports.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-3xl">
        {/* Database Export card */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div>
            <p className="font-semibold">Database Export</p>
            <p className="text-sm text-muted-foreground mt-0.5">Raw data from all tables.</p>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1">
            {DB_TABLES.map((t) => (
              <li key={t.key} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-muted-foreground/40 inline-block" />
                {t.label}
              </li>
            ))}
          </ul>
          <Button onClick={handleDbExport} disabled={dbLoading} className="w-full">
            {dbLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <DownloadIcon className="size-4" />
            )}
            {dbLoading ? "Preparing…" : "Database Export (.xlsx)"}
          </Button>
        </div>

        {/* Executive Report card */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div>
            <p className="font-semibold">Executive Report</p>
            <p className="text-sm text-muted-foreground mt-0.5">Business summary for leadership.</p>
          </div>

          <ul className="space-y-1.5">
            {REPORT_SHEETS.map((s) => (
              <li key={s.key}>
                <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selectedSheets.has(s.key)}
                    onChange={() => toggleSheet(s.key)}
                    className="size-3.5 accent-primary cursor-pointer"
                  />
                  <span
                    className={
                      selectedSheets.has(s.key) ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    {s.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Product</Label>
              <Select value={productId} onValueChange={(v) => setProductId(v ?? "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {productId === "all"
                      ? "All products"
                      : (products.find((p) => String(p.id) === productId)?.name ?? "All products")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            {!from && !to && (
              <p className="text-xs text-muted-foreground">No dates selected — all-time data.</p>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Format</Label>
              <Select value={reportFormat} onValueChange={(v) => setReportFormat(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select format…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleReportView}
              disabled={viewLoading || !canGenerate}
              className="flex-1"
            >
              {viewLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <EyeIcon className="size-4" />
              )}
              {viewLoading ? "Loading…" : "View"}
            </Button>
            <Button
              onClick={handleReportExport}
              disabled={reportLoading || !canGenerate || !reportFormat}
              className="flex-1"
            >
              {reportLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <DownloadIcon className="size-4" />
              )}
              {reportLoading ? "Generating…" : "Download"}
            </Button>
          </div>
        </div>
      </div>

      {/* Report Preview Dialog */}
      <Dialog.Root open={viewOpen} onOpenChange={setViewOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex flex-col w-[95vw] max-w-6xl h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-popover shadow-xl transition-all duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <Dialog.Title className="text-base font-semibold">
                Executive Report Preview
              </Dialog.Title>
              <Dialog.Close className="text-muted-foreground hover:text-foreground text-xl leading-none px-1">
                ×
              </Dialog.Close>
            </div>

            {/* Sheet tabs */}
            <div className="flex border-b shrink-0 overflow-x-auto">
              {viewData.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setActiveTab(s.key)}
                  className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === s.key
                      ? "border-primary text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {activeSheet && activeSheet.rows.length > 0 ? (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="text-left px-3 py-2 bg-muted font-medium text-muted-foreground border border-border whitespace-nowrap sticky top-0"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeSheet.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/40">
                        {columns.map((col) => (
                          <td
                            key={col}
                            className="px-3 py-1.5 border border-border text-foreground whitespace-nowrap"
                          >
                            {String(row[col] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">No data for this sheet.</p>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
