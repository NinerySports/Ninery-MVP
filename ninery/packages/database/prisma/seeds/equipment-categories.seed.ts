import { clearReferenceData, upsertReferenceData } from "./client.ts";

export const equipmentCategories = [
  ["bat", "Bat"],
  ["glove", "Glove"],
  ["cleats", "Cleats"],
  ["helmet", "Helmet"],
  ["batting-gloves", "Batting Gloves"],
  ["catcher-gear", "Catcher Gear"],
  ["training-equipment", "Training Equipment"],
  ["protective-equipment", "Protective Equipment"]
].map(([code, name], index) => ({ code, name, sortOrder: index + 1 }));

export async function seed() {
  await upsertReferenceData("equipment_category", equipmentCategories);
}

export async function clear() {
  await clearReferenceData("equipment_category");
}
