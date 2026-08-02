"use client";

import type { ReactNode } from "react";
import { PlayerProfileProvider } from "./player-profile-context";

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return <PlayerProfileProvider>{children}</PlayerProfileProvider>;
}
