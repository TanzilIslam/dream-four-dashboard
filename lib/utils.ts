import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a BDT amount with the ৳ symbol. Accepts numbers or numeric strings. */
export function formatTaka(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "৳0";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "৳0";
  return `৳${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
