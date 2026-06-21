"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Props = {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function DateRangeFilter({ from, to, onFromChange, onToChange }: Props) {
  const presets = [
    {
      label: "Today",
      apply: () => {
        const t = isoDate(new Date());
        onFromChange(t);
        onToChange(t);
      },
    },
    {
      label: "This Week",
      apply: () => {
        const now = new Date();
        const day = now.getDay();
        const mon = new Date(now);
        mon.setDate(now.getDate() - ((day + 6) % 7));
        onFromChange(isoDate(mon));
        onToChange(isoDate(now));
      },
    },
    {
      label: "This Month",
      apply: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        onFromChange(isoDate(start));
        onToChange(isoDate(now));
      },
    },
    {
      label: "All Time",
      apply: () => {
        onFromChange("");
        onToChange("");
      },
    },
  ];

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-1.5">
        <Label className="text-sm text-muted-foreground">From</Label>
        <Input
          type="date"
          className="w-36"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Label className="text-sm text-muted-foreground">To</Label>
        <Input
          type="date"
          className="w-36"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
        />
      </div>
      <div className="flex gap-1">
        {presets.map((p) => (
          <Button
            key={p.label}
            size="sm"
            variant="outline"
            onClick={p.apply}
            className="text-xs h-8"
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
