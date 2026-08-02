import type { EquipmentDNAAttribute } from "../equipment-dna.types.js";

export const EQUIPMENT_DNA_MAPPING_VERSION = "equipment-dna-characteristic-map-v1";

export const characteristicCodeToAttribute: Record<string, EquipmentDNAAttribute> = {
  BAT_CONTROL: "batControl",
  "BAT-CONTROL": "batControl",
  SWING_BALANCE: "balance",
  "SWING-BALANCE": "balance",
  BALANCE: "balance",
  SWING_WEIGHT: "swingWeight",
  "SWING-WEIGHT": "swingWeight",
  BARREL_FORGIVENESS: "barrelForgiveness",
  "BARREL-FORGIVENESS": "barrelForgiveness",
  SWEET_SPOT_SIZE: "sweetSpotSize",
  "SWEET-SPOT-SIZE": "sweetSpotSize",
  POWER_POTENTIAL: "powerPotential",
  "POWER-POTENTIAL": "powerPotential",
  CONFIDENCE_BUILDING: "confidenceBuilding",
  "CONFIDENCE-BUILDING": "confidenceBuilding",
  TRANSITION_FRIENDLINESS: "transitionFriendliness",
  "TRANSITION-FRIENDLINESS": "transitionFriendliness"
};

export const attributeToCharacteristicCode: Record<EquipmentDNAAttribute, string> = {
  batControl: "BAT_CONTROL",
  balance: "SWING_BALANCE",
  swingWeight: "SWING_WEIGHT",
  barrelForgiveness: "BARREL_FORGIVENESS",
  sweetSpotSize: "SWEET_SPOT_SIZE",
  powerPotential: "POWER_POTENTIAL",
  confidenceBuilding: "CONFIDENCE_BUILDING",
  transitionFriendliness: "TRANSITION_FRIENDLINESS"
};

export function mapCharacteristicCode(code: string): EquipmentDNAAttribute | undefined {
  return characteristicCodeToAttribute[code.trim().toUpperCase().replaceAll("_", "-")] ?? characteristicCodeToAttribute[code.trim().toUpperCase()];
}
