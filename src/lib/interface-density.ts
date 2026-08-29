export type InterfaceDensity = "comfortable" | "compact";

export const interfaceDensityStorageKey = "stawy-os-interface-density";
export const interfaceDensityEvent = "stawy-os-interface-density-change";
let memoryDensity: InterfaceDensity = "comfortable";

export function readInterfaceDensity(): InterfaceDensity {
  if (typeof window === "undefined") return "comfortable";
  try {
    const saved = window.localStorage?.getItem(interfaceDensityStorageKey);
    if (saved === "compact" || saved === "comfortable") memoryDensity = saved;
    return memoryDensity;
  } catch {
    return memoryDensity;
  }
}

export function writeInterfaceDensity(density: InterfaceDensity) {
  memoryDensity = density;
  try {
    window.localStorage?.setItem(interfaceDensityStorageKey, density);
  } catch {
    // Ustawienie nadal działa w bieżącej karcie, nawet gdy zapis lokalny jest zablokowany.
  }
  window.dispatchEvent(new CustomEvent<InterfaceDensity>(interfaceDensityEvent, { detail: density }));
}

export function subscribeInterfaceDensity(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === interfaceDensityStorageKey) onStoreChange();
  };
  window.addEventListener(interfaceDensityEvent, onStoreChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(interfaceDensityEvent, onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}
