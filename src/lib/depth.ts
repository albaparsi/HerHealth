import type { CSSProperties } from "react";

/** Style for a `.rise` item: its order in the entrance stagger and how far it floats in front of the panel. */
export function at(order: number, z = 0): CSSProperties {
  return { "--i": order, "--z": `${z}px` } as CSSProperties;
}
