"use client";

import { useEffect, useState } from "react";

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
        <input
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="New entry..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting || !input.trim()}
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-zinc-400">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-zinc-400">No entries yet.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between rounded border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <span className="text-sm">{entry.content}</span>
              <span className="ml-4 shrink-0 text-xs text-zinc-400">
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
