import Link from "next/link";
import {
  Package,
  Receipt,
  Wallet,
  AlertCircle,
  CalendarCheck,
  HandCoins,
  TrendingUp,
  DollarSign,
} from "lucide-react";

const REPORTS = [
  {
    label: "Investment Ledger",
    href: "/dashboard/reports/investment-ledger",
    icon: Package,
    desc: "All stock purchases across partners",
  },
  {
    label: "Expense Ledger",
    href: "/dashboard/reports/expense-ledger",
    icon: Receipt,
    desc: "All expenses by category and partner",
  },
  {
    label: "Cash Flow",
    href: "/dashboard/reports/cash-flow",
    icon: Wallet,
    desc: "Per-partner: invested, collected, in-hand",
  },
  {
    label: "Due Report",
    href: "/dashboard/reports/due-report",
    icon: AlertCircle,
    desc: "All customers with outstanding balances",
  },
  {
    label: "Attendance Report",
    href: "/dashboard/reports/attendance-report",
    icon: CalendarCheck,
    desc: "Hours worked, late/absent breakdown",
  },
  {
    label: "Loan Report",
    href: "/dashboard/reports/loan-report",
    icon: HandCoins,
    desc: "Partner loans, repayments, outstanding",
  },
  {
    label: "P&L Report",
    href: "/dashboard/reports/pnl",
    icon: TrendingUp,
    desc: "Revenue vs cost vs net per partner and area",
  },
  {
    label: "Profit Settlement",
    href: "/dashboard/reports/settlement",
    icon: DollarSign,
    desc: "Period P&L → tech share → partner payout",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Deep-dive analytics and period reports.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded-lg border border-border p-4 hover:bg-accent transition-colors group"
          >
            <div className="flex items-start gap-3">
              <r.icon className="size-5 text-muted-foreground group-hover:text-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{r.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
