"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CustomerScorePage from "@/components/score/customer-score-page";

function ScorePageContent() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name");

  return <CustomerScorePage initialName={name} />;
}

export default function ScorePage() {
  return (
    <Suspense fallback={null}>
      <ScorePageContent />
    </Suspense>
  );
}
