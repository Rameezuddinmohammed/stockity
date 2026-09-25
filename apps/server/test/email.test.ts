import { describe, expect, it } from "vitest";
import {
  canonicalEmail,
  domainCandidates,
  isAlumniDomain,
  isDisposableDomain,
} from "../src/lib/email";

describe("email helpers", () => {
  it("canonicalizes case and +tags", () => {
    expect(canonicalEmail(" Riya+Quad@IITB.ac.in")).toBe("riya@iitb.ac.in");
  });
  it("lists parent domains down to two labels", () => {
    expect(domainCandidates("cs.mail.utoronto.ca")).toEqual([
      "cs.mail.utoronto.ca",
      "mail.utoronto.ca",
      "utoronto.ca",
    ]);
    expect(domainCandidates("localhost")).toEqual([]);
  });
  it("spots alumni subdomains", () => {
    expect(isAlumniDomain("alumni.utoronto.ca")).toBe(true);
    expect(isAlumniDomain("alum.mit.edu")).toBe(true);
    expect(isAlumniDomain("mail.utoronto.ca")).toBe(false);
  });
  it("spots disposable domains", () => {
    expect(isDisposableDomain("mailinator.com")).toBe(true);
    expect(isDisposableDomain("utoronto.ca")).toBe(false);
  });
});
