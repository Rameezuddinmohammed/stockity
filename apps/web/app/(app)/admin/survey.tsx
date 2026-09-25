"use client";

import { SURVEY_MODES, type SurveyResults } from "@quad/shared";
import { Notice } from "@quad/ui";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";

const pct = (n: number, max: number) => (max === 0 ? 0 : (n / max) * 100);
const offsetHours = () => -new Date().getTimezoneOffset() / 60;
const localHour = (utc: number) => (((utc + offsetHours()) % 24) + 24) % 24;
const fmtHour = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;

/** Phase 0 demand survey: which modes to build first, and when to hold Global Hour. */
export function Survey() {
  const [data, setData] = useState<SurveyResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SurveyResults>("/admin/survey").then(setData, (err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Notice tone="danger">{error}</Notice>;
  if (!data) return null;

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const modeMax = Math.max(...Object.values(data.modes), 0);
  const hourMax = Math.max(...data.hoursUtc, 0);
  const best = hourMax > 0 ? data.hoursUtc.indexOf(hourMax) : null;
  const columns = data.hoursUtc
    .map((v, utc) => ({ v, utc, local: localHour(utc) }))
    .sort((a, b) => a.local - b.local);

  return (
    <div className="grid gap-8">
      <div className="grid gap-1">
        <span className="text-sm text-muted">Responses</span>
        <span className="font-body text-5xl font-semibold tabular-nums">
          {data.responses.toLocaleString()}
        </span>
      </div>

      <section className="grid gap-3" aria-labelledby="modes-title">
        <div>
          <h2 id="modes-title" className="font-body text-lg font-bold">
            Which modes students want
          </h2>
          <p className="text-sm text-muted">People could pick more than one.</p>
        </div>
        <div className="grid gap-2.5">
          {SURVEY_MODES.map((m) => {
            const v = data.modes[m.id];
            return (
              <div
                key={m.id}
                className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3 text-sm"
              >
                <span>{m.label}</span>
                <div className="flex items-center gap-2" title={`${m.label}: ${v}`}>
                  <span
                    className="block h-5 rounded-r-[4px]"
                    style={{
                      width: `${pct(v, modeMax)}%`,
                      minWidth: v > 0 ? 4 : 0,
                      background: "var(--chart-mark)",
                    }}
                  />
                  <span className="tabular-nums text-muted">{v}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3" aria-labelledby="hours-title">
        <div>
          <h2 id="hours-title" className="font-body text-lg font-bold">
            When students are free
          </h2>
          <p className="text-sm text-muted">
            People free in each hour, shown in your time zone ({tz}).
            {best !== null && (
              <>
                {" "}
                Busiest: <strong className="text-ink">{fmtHour(localHour(best))}</strong> ({hourMax}{" "}
                {hourMax === 1 ? "person" : "people"}, {String(best).padStart(2, "0")}:00 UTC).
              </>
            )}
          </p>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="relative flex h-40 items-end gap-[2px] border-b border-hairline">
              {columns.map(({ v, utc, local }) => (
                <div
                  key={utc}
                  className="group relative flex h-full flex-1 items-end justify-center outline-none"
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: lets keyboard users reach each hour's tooltip
                  tabIndex={0}
                  role="img"
                  aria-label={`${fmtHour(local)}: ${v} ${v === 1 ? "person" : "people"}`}
                >
                  <span
                    className="block w-full max-w-6 rounded-t-[4px]"
                    style={{
                      height: `${pct(v, hourMax)}%`,
                      minHeight: v > 0 ? 4 : 0,
                      background: "var(--chart-mark)",
                    }}
                  />
                  {utc === best && (
                    <span className="absolute -top-5 text-xs font-semibold tabular-nums">{v}</span>
                  )}
                  <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg border border-hairline bg-surface px-2 py-1 text-xs shadow-sm group-hover:block group-focus-visible:block">
                    {fmtHour(local)} · {v} {v === 1 ? "person" : "people"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-[2px] text-[11px] text-muted">
              {columns.map(({ utc, local }, i) => (
                <span key={utc} className="flex-1 text-center tabular-nums">
                  {i % 3 === 0 ? fmtHour(local) : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Show as table</summary>
          <table className="mt-2 w-full max-w-sm text-left tabular-nums">
            <thead className="text-muted">
              <tr>
                <th className="py-1 font-semibold">Your time</th>
                <th className="py-1 font-semibold">UTC</th>
                <th className="py-1 font-semibold">People</th>
              </tr>
            </thead>
            <tbody>
              {data.hoursUtc.map((v, utc) => (
                <tr key={utc} className="border-t border-hairline">
                  <td className="py-1">{fmtHour(localHour(utc))}</td>
                  <td className="py-1">{String(utc).padStart(2, "0")}:00</td>
                  <td className="py-1">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </div>
  );
}
