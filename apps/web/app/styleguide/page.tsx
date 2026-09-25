import type { Metadata } from "next";
import { Styleguide } from "./styleguide";

export const metadata: Metadata = { title: "Styleguide", robots: { index: false } };

export default function StyleguidePage() {
  return <Styleguide />;
}
