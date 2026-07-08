import { clearReferenceData, upsertReferenceData } from "./client.ts";

export const positions = [
  ["pitcher", "Pitcher"],
  ["catcher", "Catcher"],
  ["first-base", "1B"],
  ["second-base", "2B"],
  ["third-base", "3B"],
  ["shortstop", "SS"],
  ["left-field", "LF"],
  ["center-field", "CF"],
  ["right-field", "RF"],
  ["designated-hitter", "DH"],
  ["utility", "Utility"]
].map(([code, name], index) => ({ code, name, sortOrder: index + 1 }));

export const competitionLevels = [
  ["recreational", "Recreational"],
  ["little-league", "Little League"],
  ["school", "School"],
  ["travel", "Travel"],
  ["elite-travel", "Elite Travel"],
  ["showcase", "Showcase"]
].map(([code, name], index) => ({ code, name, sortOrder: index + 1 }));

export async function seed() {
  await upsertReferenceData("position", positions);
  await upsertReferenceData("competition_level", competitionLevels);
}

export async function clear() {
  await clearReferenceData("competition_level");
  await clearReferenceData("position");
}
