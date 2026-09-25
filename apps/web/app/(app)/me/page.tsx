import type { Metadata } from "next";
import { MeView } from "./me-view";

export const metadata: Metadata = { title: "Me" };

export default function MePage() {
  return <MeView />;
}
