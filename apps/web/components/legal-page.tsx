import { readFile } from "node:fs/promises";
import path from "node:path";
import { Logo, Notice } from "@quad/ui";
import { marked } from "marked";
import Link from "next/link";

/** Flip to false once a lawyer has reviewed the drafts and the placeholders are filled in. */
export const LEGAL_DRAFT = true;

/** Renders one of our own Markdown files from content/legal at build time (trusted input). */
export async function LegalPage({ file }: { file: "terms" | "privacy" }) {
  const source = await readFile(path.join(process.cwd(), "content/legal", `${file}.md`), "utf8");
  const html = await marked.parse(source, { gfm: true });
  return (
    <div className="mx-auto grid max-w-[760px] gap-8 px-4 py-8">
      <Link href="/" aria-label="Quad home">
        <Logo />
      </Link>
      {LEGAL_DRAFT && (
        <Notice title="Draft">
          This document is a draft and isn't in effect yet. Details in [BRACKETS] will be filled in
          before launch.
        </Notice>
      )}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: our own Markdown from the repo, rendered at build time */}
      <article className="q-prose" dangerouslySetInnerHTML={{ __html: html }} />
      <nav className="flex flex-wrap gap-5 border-t border-hairline pt-5 text-sm">
        <Link href="/terms" className="underline">
          Terms of Service
        </Link>
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        <Link href="/guidelines" className="underline">
          Community guidelines
        </Link>
      </nav>
    </div>
  );
}
