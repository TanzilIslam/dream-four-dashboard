"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StockRow = {
  id: number;
  name: string;
  unit: string;
  low_stock_threshold: number | null;
  purchased_qty: number;
  reserved_qty: number;
  delivered_qty: number;
  returned_qty: number;
  available_qty: number;
};

function stockStatus(row: StockRow): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (row.available_qty <= 0) return { label: "Out of stock", variant: "destructive" };
  if (row.low_stock_threshold != null && row.available_qty <= row.low_stock_threshold)
    return { label: "Low stock", variant: "secondary" };
  return { label: "In stock", variant: "default" };
}

export default function StockPage() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stock")
      .then((r) => r.json())
      .then((d) => {
        setStock(d.map((row: StockRow) => ({
          ...row,
          purchased_qty: Number(row.purchased_qty),
          reserved_qty: Number(row.reserved_qty),
          delivered_qty: Number(row.delivered_qty),
          returned_qty: Number(row.returned_qty),
          available_qty: Number(row.available_qty),
        })));
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Stock</h1>
        <p className="text-sm text-muted-foreground">Current inventory levels across all products.</p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Purchased</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Returned</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : stock.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              stock.map((row) => {
                const status = stockStatus(row);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.name}
                      <span className="ml-1.5 text-xs text-muted-foreground">({row.unit})</span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.purchased_qty}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.reserved_qty}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.delivered_qty}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.returned_qty}</TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        row.available_qty <= 0
                          ? "text-red-600"
                          : row.low_stock_threshold != null && row.available_qty <= row.low_stock_threshold
                          ? "text-yellow-600"
                          : "text-green-600"
                      }`}
                    >
                      {row.available_qty}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Available = Purchased − Reserved (pending orders) − Delivered + Returned
      </p>
    </div>
  );
}
