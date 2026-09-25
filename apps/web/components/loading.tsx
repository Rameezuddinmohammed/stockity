import { Pip } from "@quad/ui";

export function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
      <Pip size={56} className="q-bob" />
    </div>
  );
}
