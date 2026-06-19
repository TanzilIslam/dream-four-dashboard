"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Entry = {
  id: number;
  content: string;
  created_at: string;
};

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function fetchEntries() {
    const res = await fetch("/api/entries");
    const data = await res.json();
    setEntries(data);
    setLoading(false);
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setSubmitting(true);
    await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input.trim() }),
    });
    setInput("");
    await fetchEntries();
    setSubmitting(false);
  }

  useEffect(() => {
    fetchEntries();
  }, []);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="mb-8 text-2xl font-semibold">Dashboard</h1>

      <form onSubmit={addEntry} className="mb-8 flex gap-2">
        <Input
          placeholder="New entry..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitting}
        />
        <Button type="submit" disabled={submitting || !input.trim()}>
          Add
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex items-start justify-between py-3">
                <span className="text-sm">{entry.content}</span>
                <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
