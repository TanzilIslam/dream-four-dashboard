"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Truck,
  MapPin,
  Package,
  Tags,
  Receipt,
  Settings2,
  DatabaseZap,
  ContactRound,
  ShoppingCart,
  ClipboardList,
  Undo2,
  Wallet,
  Banknote,
  HandCoins,
  AlertCircle,
  CalendarCheck,
  CheckSquare,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = { label?: string; adminOnly?: boolean; items: NavItem[] };

const navSections: NavSection[] = [
  {
    items: [{ label: "Overview", href: "/dashboard/overview", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { label: "Customers", href: "/dashboard/customers", icon: ContactRound },
      { label: "Orders", href: "/dashboard/orders", icon: ShoppingCart },
      { label: "Purchase Requests", href: "/dashboard/purchase-requests", icon: ClipboardList },
      { label: "Returns", href: "/dashboard/returns", icon: Undo2 },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Expenses", href: "/dashboard/expenses", icon: Wallet },
      { label: "Cash Remittances", href: "/dashboard/cash-remittances", icon: Banknote },
      { label: "Dues", href: "/dashboard/dues", icon: AlertCircle },
      { label: "Partner Loans", href: "/dashboard/partner-loans", icon: HandCoins },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Attendance", href: "/dashboard/attendance", icon: CalendarCheck },
      { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
      { label: "Daily Reports", href: "/dashboard/daily-reports", icon: FileText },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [{ label: "Users", href: "/dashboard/users", icon: Users }],
  },
  {
    label: "Settings",
    adminOnly: true,
    items: [
      { label: "Suppliers", href: "/dashboard/settings/suppliers", icon: Truck },
      { label: "Areas", href: "/dashboard/settings/areas", icon: MapPin },
      { label: "Products", href: "/dashboard/settings/products", icon: Package },
      { label: "Pricing Tiers", href: "/dashboard/settings/pricing-tiers", icon: Tags },
      {
        label: "Expense Categories",
        href: "/dashboard/settings/expense-categories",
        icon: Receipt,
      },
      { label: "Payment Config", href: "/dashboard/settings/payment-config", icon: Settings2 },
    ],
  },
];

function AppSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <span className="font-semibold text-base tracking-tight group-data-[collapsible=icon]:hidden">
          Dream Four
        </span>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {navSections
          .filter((section) => !section.adminOnly || isAdmin)
          .map((section, i) => (
            <SidebarGroup key={section.label ?? `group-${i}`}>
              {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={pathname === item.href}
                        tooltip={item.label}
                        className="data-active:shadow-md"
                      >
                        <item.icon className="shrink-0" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
      </SidebarContent>

      <SidebarFooter />
    </Sidebar>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setIsAdmin(data.user?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Signed out");
    router.push("/login");
  }

  return (
    <SidebarProvider>
      <AppSidebar isAdmin={isAdmin} />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex h-14 items-center gap-3 border-b border-border px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <div className="flex flex-1 items-center justify-between">
            <span className="text-sm font-medium">Dashboard</span>
            <div className="flex items-center gap-1">
              {process.env.NODE_ENV === "development" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-orange-500"
                  title="Run /api/setup (dev only)"
                  onClick={() => fetch("/api/setup").then(() => window.location.reload())}
                >
                  <DatabaseZap className="size-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="size-8">
                <Link href="/dashboard/profile">
                  <UserCircle className="size-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </SidebarProvider>
  );
}
