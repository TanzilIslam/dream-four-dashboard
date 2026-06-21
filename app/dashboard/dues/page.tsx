"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
type DueRow = {
  customer_id: number;
  customer_name: string;
  customer_phone: string | null;
  area_name: string | null;
  partner_name?: string | null;
  total_due: string;
  order_count: string;
};

export default function DuesPage() {
  const [dues, setDues] = useState<DueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setIsAdmin(data.user?.role === "admin"))
      .catch(() => setIsAdmin(false));

    fetch("/api/dues")
      .then((res) => res.json())
      .then((data) => {
        setDues(data);
        setLoading(false);
      });
  }, []);

  const grandTotal = dues.reduce((sum, d) => sum + Number(d.total_due), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Outstanding Dues</h1>
          <p className="text-sm text-muted-foreground">Customers with unpaid balances.</p>
        </div>
        {dues.length > 0 && (
          <span className="text-sm font-semibold text-red-600">
            Total: ৳{grandTotal.toFixed(2)}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Partner</TableHead>}
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Due Amount</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 7 : 6}
                  className="text-center text-muted-foreground py-10"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : dues.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 7 : 6}
                  className="text-center text-muted-foreground py-10"
                >
                  No outstanding dues
                </TableCell>
              </TableRow>
            ) : (
              dues.map((d) => (
                <TableRow key={d.customer_id}>
                  {isAdmin && <TableCell>{d.partner_name ?? "—"}</TableCell>}
                  <TableCell className="font-medium">{d.customer_name}</TableCell>
                  <TableCell className="text-muted-foreground">{d.customer_phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.area_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.order_count}</TableCell>
                  <TableCell className="font-semibold text-red-600">
                    ৳{Number(d.total_due).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/orders?customer_id=${d.customer_id}`}
                      title="View orders"
                      className="inline-flex items-center justify-center size-7 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
