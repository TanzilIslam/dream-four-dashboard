"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Client-side guard for admin-only pages. Authorization is enforced on the API
 * too; this just keeps partners from seeing an empty admin screen.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "allowed">("checking");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (data.user?.role === "admin") {
          setState("allowed");
        } else {
          router.replace("/dashboard/overview");
        }
      })
      .catch(() => router.replace("/dashboard/overview"));
  }, [router]);

  if (state === "checking") {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return <>{children}</>;
}
