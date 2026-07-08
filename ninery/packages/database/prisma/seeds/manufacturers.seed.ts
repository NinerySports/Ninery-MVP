import { clearReferenceData, upsertReferenceData } from "./client.ts";

export const manufacturers = [
  "Easton",
  "Louisville Slugger",
  "Marucci",
  "Victus",
  "Rawlings",
  "Warstic",
  "StringKing",
  "DeMarini",
  "Mizuno",
  "Axe",
  "True Temper",
  "Chandler",
  "Baum",
  "Old Hickory",
  "Combat"
].map((name, index) => ({
  code: name.toLowerCase().replaceAll(" ", "-"),
  name,
  sortOrder: index + 1
}));

export async function seed() {
  await upsertReferenceData("manufacturer", manufacturers);
}

export async function clear() {
  await clearReferenceData("manufacturer");
}
