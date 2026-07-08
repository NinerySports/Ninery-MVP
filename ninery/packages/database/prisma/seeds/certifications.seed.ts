import { clearReferenceData, upsertReferenceData } from "./client.ts";

export const certifications = [
  ["usa-baseball", "USA Baseball"],
  ["usssa", "USSSA"],
  ["bbcor", "BBCOR"],
  ["none", "None"],
  ["unknown", "Unknown"]
].map(([code, name], index) => ({ code, name, sortOrder: index + 1 }));

export async function seed() {
  await upsertReferenceData("certification", certifications);
}

export async function clear() {
  await clearReferenceData("certification");
}
