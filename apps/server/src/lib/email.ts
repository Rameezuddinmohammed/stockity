import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const disposable = new Set<string>(require("disposable-email-domains") as string[]);

export function splitEmail(email: string): { local: string; domain: string } {
  const at = email.lastIndexOf("@");
  return { local: email.slice(0, at), domain: email.slice(at + 1).toLowerCase() };
}

/** Lowercase and drop any "+tag", so riya+quad@x.edu and riya@x.edu are one account. */
export function canonicalEmail(email: string): string {
  const { local, domain } = splitEmail(email.trim().toLowerCase());
  return `${local.split("+")[0]}@${domain}`;
}

/** The domain and every parent with at least two labels: cs.mail.uni.edu → [cs.mail.uni.edu, mail.uni.edu, uni.edu]. */
export function domainCandidates(domain: string): string[] {
  const labels = domain.toLowerCase().replace(/\.$/, "").split(".");
  const out: string[] = [];
  for (let i = 0; i <= labels.length - 2; i++) out.push(labels.slice(i).join("."));
  return out;
}

const ALUMNI_LABEL = /^(alumni|alumnae|alumnus|alumna|alum|alumnos|ehemalige)$/;

export const isAlumniDomain = (domain: string) =>
  domain
    .toLowerCase()
    .split(".")
    .some((label) => ALUMNI_LABEL.test(label));

export const isDisposableDomain = (domain: string) =>
  domainCandidates(domain).some((d) => disposable.has(d));
