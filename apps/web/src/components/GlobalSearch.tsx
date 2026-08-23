// components/GlobalSearch.tsx
"use client";

import { Loader2, Phone, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSearchHospitalPatients } from "@/hooks/useNewPatientApi";

interface GlobalSearchProps {
  hospitalId: string;
}

function getInitials(name?: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function GlobalSearch({ hospitalId }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setHighlighted(0);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const { data, isFetching } = useSearchHospitalPatients(
    hospitalId,
    debouncedQuery,
  );
  const results = data?.patients || [];
  const showDropdown = open && debouncedQuery.length >= 2;

  // ⌘K / Ctrl+K jumps focus here from anywhere in the app.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const goToPatient = (patientId: string) => {
    router.push(`/hospital/${hospitalId}/patients/${patientId}`);
    setQuery("");
    setDebouncedQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!showDropdown || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = results[highlighted];
      if (picked) goToPatient(picked.id);
    }
  };

  return (
    <div className="relative hidden lg:block" ref={containerRef}>
      <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search patients by name or phone"
        className="pl-9 pr-14 py-2 rounded-lg border border-border bg-surface-canvas text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-violet/30 focus:border-brand-violet placeholder:text-ink-500"
      />
      {!query && (
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-ink-500 bg-surface-paper border border-border rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
      )}

      {showDropdown && (
        <div className="absolute left-0 top-full mt-1.5 w-80 bg-surface-paper rounded-xl shadow-2xl border border-border overflow-hidden z-50">
          {isFetching ? (
            <div className="px-4 py-4 text-sm text-ink-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-4 text-sm text-ink-500">
              No patients match &ldquo;{debouncedQuery}&rdquo;.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {results.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => goToPatient(p.id)}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === highlighted
                      ? "bg-brand-violet-soft"
                      : "hover:bg-surface-canvas"
                  }`}
                >
                  <span className="w-8 h-8 rounded-lg bg-brand-violet-soft text-brand-violet flex items-center justify-center text-xs font-bold shrink-0">
                    {getInitials(p.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink-900 truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-ink-500 flex items-center gap-1">
                      <Phone className="w-3 h-3 shrink-0" />
                      <span className="font-mono">{p.phone}</span>
                      {p.patientId && (
                        <span className="font-mono"> · #{p.patientId}</span>
                      )}
                    </div>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
