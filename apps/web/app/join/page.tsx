import type { Metadata } from "next";
import { JoinFlow } from "./join-flow";

export const metadata: Metadata = { title: "Get in" };

export default function JoinPage() {
  return <JoinFlow />;
}
