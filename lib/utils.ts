import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Extracts a readable string from a Zod fieldErrors object or plain string error. */
export function extractError(error: unknown, fallback = "An error occurred"): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const messages = Object.values(error as Record<string, unknown>)
      .flat()
      .filter((v) => typeof v === "string") as string[];
    if (messages.length > 0) return messages.join(", ");
  }
  return fallback;
}

/** Format a date as "18 Jul 2026" (en-GB short). */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Format a BDT amount with the ৳ symbol. Accepts numbers or numeric strings. */
export function formatTaka(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "৳0";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "৳0";
  return `৳${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
