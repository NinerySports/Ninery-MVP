import type { Metadata } from "next";
import { BatMatchResultsClient } from "./batmatch-results-client";

export const metadata: Metadata = {
  title: "BatMatch Results | Ninery",
  description: "Review a demo Ninery bat recommendation with player profile context and explainable fit signals."
};

export default function BatMatchDemoResultsPage() {
  return <BatMatchResultsClient />;
}