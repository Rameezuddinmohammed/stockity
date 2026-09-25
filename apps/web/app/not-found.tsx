import { buttonClass, Pip } from "@quad/ui";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-dvh max-w-[480px] content-center justify-items-start gap-4 px-4">
      <Pip size={72} mood="sleepy" />
      <h1 className="text-[39px] font-extrabold leading-none tracking-[-0.02em]">nothing here.</h1>
      <p className="text-muted">This page doesn't exist, or it moved.</p>
      <Link href="/" className={buttonClass("primary")}>
        Back to the Quad →
      </Link>
    </div>
  );
}
