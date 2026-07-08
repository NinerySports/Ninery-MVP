import { prisma } from "./client.ts";

export const equipmentCharacteristics = [
  ["bat-control", "Bat Control™", "How easily a player can control the barrel through the hitting zone."],
  ["swing-balance", "Swing Balance™", "How naturally the bat stays balanced throughout the swing."],
  ["swing-weight", "Swing Weight™", "How heavy the bat feels in motion, independent of scale weight."],
  ["sweet-spot-size", "Sweet Spot Size™", "The usable hitting area where contact is most productive."],
  ["barrel-forgiveness", "Barrel Forgiveness™", "How well the barrel performs on less-than-perfect contact."],
  ["power-potential", "Power Potential™", "The bat's ability to help convert swing speed into damage."],
  ["exit-velocity-potential", "Exit Velocity Potential™", "Projected support for high-quality exit velocity."],
  ["confidence-building", "Confidence Building™", "How well the bat supports comfort, timing, and trust."],
  ["transition-friendliness", "Transition Friendliness™", "How approachable the bat is when changing size, drop, or certification."],
  ["contact-consistency", "Contact Consistency™", "How well the bat supports repeatable barrel contact."],
  ["mishit-forgiveness", "Mishit Forgiveness™", "How much performance is retained on off-center contact."],
  ["swing-tempo", "Swing Tempo™", "How well the bat supports rhythm and sequencing."],
  ["vibration-dampening", "Vibration Dampening™", "How effectively the bat reduces sting and vibration."],
  ["handle-feel", "Handle Feel™", "How comfortable and connected the handle feels in the hands."],
  ["barrel-feel", "Barrel Feel™", "How clearly the player can feel the barrel during the swing."],
  ["launch-angle-support", "Launch Angle Support™", "How well the bat supports productive ball flight."],
  ["plate-coverage", "Plate Coverage™", "How well the bat supports reaching pitches across the zone."],
  ["reaction-speed", "Reaction Speed™", "How well the bat supports quick decisions and late adjustability."],
  ["control-window", "Control Window™", "How long the barrel remains controllable through the hitting zone."],
  ["fatigue-resistance", "Fatigue Resistance™", "How well swing quality holds up over repeated swings."]
].map(([code, name, description]) => ({
  code,
  name,
  description,
  category: "bat",
  version: 1
}));

export async function seed() {
  for (const characteristic of equipmentCharacteristics) {
    await prisma.equipmentCharacteristic.upsert({
      where: { code: characteristic.code },
      update: characteristic,
      create: characteristic
    });
  }
}

export async function clear() {
  await prisma.equipmentDNAScore.deleteMany({
    where: {
      characteristic: {
        code: { in: equipmentCharacteristics.map((characteristic) => characteristic.code) }
      }
    }
  });
  await prisma.equipmentCharacteristic.deleteMany({
    where: { code: { in: equipmentCharacteristics.map((characteristic) => characteristic.code) } }
  });
}
