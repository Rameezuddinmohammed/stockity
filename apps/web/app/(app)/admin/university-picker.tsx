"use client";

import type { University, UniversityTarget } from "@quad/shared";
import { Button, TextField } from "@quad/ui";
import { useEffect, useId, useState } from "react";
import { api, errorMessage } from "@/lib/api";

/** Pick an existing university or describe a new one. Reports a valid target (or null) upward. */
export function UniversityPicker({
  initialName = "",
  initialCountry = "",
  onChange,
}: {
  initialName?: string;
  initialCountry?: string;
  onChange: (target: UniversityTarget | null, label: string) => void;
}) {
  const id = useId();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState(initialName);
  const [results, setResults] = useState<University[] | null>(null);
  const [picked, setPicked] = useState<University | null>(null);
  const [name, setName] = useState(initialName);
  const [country, setCountry] = useState(initialCountry);
  const [countryCode, setCountryCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "existing") {
      onChange(picked ? { universityId: picked.id } : null, picked?.name ?? "");
    } else {
      const ok =
        name.trim().length >= 2 && country.trim().length >= 2 && /^[a-z]{2}$/i.test(countryCode);
      onChange(ok ? { newUniversity: { name, country, countryCode } } : null, name);
    }
  }, [mode, picked, name, country, countryCode, onChange]);

  const search = async () => {
    setError(null);
    if (query.trim().length < 2) return;
    try {
      const res = await api<{ universities: University[] }>(
        `/admin/universities?q=${encodeURIComponent(query.trim())}`,
      );
      setResults(res.universities);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <fieldset className="grid gap-3 rounded-[14px] border border-hairline p-3">
      <legend className="px-1 text-sm font-semibold">University</legend>
      <div className="flex gap-4 text-sm">
        {(["existing", "new"] as const).map((m) => (
          <label key={m} className="flex items-center gap-2">
            <input
              type="radio"
              name={`${id}-mode`}
              checked={mode === m}
              onChange={() => setMode(m)}
            />
            {m === "existing" ? "Existing university" : "New university"}
          </label>
        ))}
      </div>

      {mode === "existing" ? (
        <div className="grid gap-2">
          <div className="flex gap-2">
            <input
              className="q-input !min-h-10 !py-2"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
              placeholder="Search by name"
              aria-label="Search universities"
            />
            <Button size="sm" variant="plain" onClick={search}>
              Search
            </Button>
          </div>
          {results?.length === 0 && (
            <p className="text-sm text-muted">
              No match. Try another spelling or create a new one.
            </p>
          )}
          {results && results.length > 0 && (
            <ul className="grid max-h-56 gap-1 overflow-y-auto text-sm">
              {results.map((u) => (
                <li key={u.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg">
                    <input
                      type="radio"
                      name={`${id}-uni`}
                      checked={picked?.id === u.id}
                      onChange={() => setPicked(u)}
                    />
                    {u.name} <span className="text-muted">· {u.countryCode}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_100px]">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
          <TextField
            label="Code"
            placeholder="NG"
            maxLength={2}
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
          />
        </div>
      )}
      {error && <span className="text-sm text-danger">{error}</span>}
    </fieldset>
  );
}
