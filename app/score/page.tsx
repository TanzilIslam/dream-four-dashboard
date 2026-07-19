"use client";

import { useSearchParams } from "next/navigation";
import CustomerScorePage from "@/components/score/customer-score-page";

export default function ScorePage() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name");

  return <CustomerScorePage initialName={name} />;
}
