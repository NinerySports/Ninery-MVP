"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type PlayerSetupProfile = {
  firstName: string;
  lastName: string;
  birthDate: string;
  height: string;
  weight: string;
  dominantHand: string;
  bats: string;
  throws: string;
  primaryPosition: string;
  secondaryPosition: string;
  competitionLevel: string;
  yearsPlaying: string;
  graduationYear: string;
  currentBatBrand: string;
  currentBatModel: string;
  currentBatLength: string;
  currentBatWeight: string;
  likesCurrentBat: string;
  goals: string[];
};

export const initialPlayerSetupProfile: PlayerSetupProfile = {
  firstName: "",
  lastName: "",
  birthDate: "",
  height: "",
  weight: "",
  dominantHand: "",
  bats: "",
  throws: "",
  primaryPosition: "",
  secondaryPosition: "",
  competitionLevel: "",
  yearsPlaying: "",
  graduationYear: "",
  currentBatBrand: "",
  currentBatModel: "",
  currentBatLength: "",
  currentBatWeight: "",
  likesCurrentBat: "",
  goals: []
};

type PlayerProfileContextValue = {
  profile: PlayerSetupProfile;
  saveProfile: (profile: PlayerSetupProfile) => void;
};

const PlayerProfileContext = createContext<PlayerProfileContextValue | null>(null);

export function PlayerProfileProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [profile, setProfile] = useState<PlayerSetupProfile>(initialPlayerSetupProfile);

  const value = useMemo(
    () => ({
      profile,
      saveProfile: setProfile
    }),
    [profile]
  );

  return <PlayerProfileContext.Provider value={value}>{children}</PlayerProfileContext.Provider>;
}

export function usePlayerProfile() {
  const context = useContext(PlayerProfileContext);

  if (!context) {
    throw new Error("usePlayerProfile must be used inside PlayerProfileProvider");
  }

  return context;
}
