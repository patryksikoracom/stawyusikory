"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  readInterfaceDensity,
  subscribeInterfaceDensity,
  writeInterfaceDensity,
  type InterfaceDensity,
} from "@/lib/interface-density";

type InterfaceDensityContextValue = {
  density: InterfaceDensity;
  setDensity: (density: InterfaceDensity) => void;
};

const InterfaceDensityContext = createContext<InterfaceDensityContextValue>({
  density: "comfortable",
  setDensity: writeInterfaceDensity,
});

export function InterfaceDensityProvider({ children }: { children: ReactNode }) {
  const density = useSyncExternalStore<InterfaceDensity>(
    subscribeInterfaceDensity,
    readInterfaceDensity,
    () => "comfortable" as const,
  );
  const value = useMemo(() => ({ density, setDensity: writeInterfaceDensity }), [density]);
  return <InterfaceDensityContext.Provider value={value}>{children}</InterfaceDensityContext.Provider>;
}

export function useInterfaceDensity() {
  return useContext(InterfaceDensityContext);
}
