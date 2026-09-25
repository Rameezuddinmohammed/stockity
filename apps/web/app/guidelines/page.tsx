import { Logo } from "@quad/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { GUIDELINES } from "@/lib/guidelines";

export const metadata: Metadata = { title: "Community guidelines" };

export default function Guidelines() {
  return (
    <div className="mx-auto grid max-w-[720px] gap-8 px-4 py-8">
      <Link href="/" aria-label="Quad home">
        <Logo />
      </Link>
      <div className="grid gap-3">
        <h1 className="text-[clamp(32px,5vw,49px)] font-extrabold tracking-[-0.02em]">
          Community guidelines
        </h1>
        <p className="text-muted">
          Quad only works if everyone feels safe. Break these and you'll get a warning, a suspension
          or a permanent ban, depending on how serious it is. Bans apply to your verified identity,
          so they stick.
        </p>
      </div>
      <ol className="grid gap-4">
        {GUIDELINES.map((g, i) => (
          <li
            key={g.title}
            className="grid gap-1 rounded-[20px] border border-hairline bg-surface p-5"
          >
            <span className="font-mono text-xs font-semibold text-muted">RULE {i + 1}</span>
            <h2 className="font-body text-lg font-bold">{g.title}</h2>
            <p className="text-[15px]">{g.body}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">
        See something that breaks these rules? Use Report during a chat. Our team reviews every
        report.
      </p>
    </div>
  );
}
