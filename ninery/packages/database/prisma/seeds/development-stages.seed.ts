import { clearReferenceData, upsertReferenceData } from "./client.ts";

export const developmentStages = [
  ["beginner", "Beginner"],
  ["developing", "Developing"],
  ["competitive", "Competitive"],
  ["advanced", "Advanced"],
  ["high-school-transition", "High School Transition"],
  ["bbcor-transition", "BBCOR Transition"]
].map(([code, name], index) => ({ code, name, sortOrder: index + 1 }));

export async function seed() {
  await upsertReferenceData("development_stage", developmentStages);
}

export async function clear() {
  await clearReferenceData("development_stage");
}
