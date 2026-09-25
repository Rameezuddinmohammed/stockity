/** Holographic verified badge (the only other place the holo gradient appears is the ID strip). */
export function Verified({ university }: { university: string }) {
  return (
    <span className="q-verified">
      <i aria-hidden="true">✓</i>
      Verified · {university}
    </span>
  );
}
