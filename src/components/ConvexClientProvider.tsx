"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = url ? new ConvexReactClient(url) : null;

export const convexEnabled = convex !== null;

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  // Without a Convex URL (e.g. a preview deploy before Convex is linked) the static pages still render.
  return convex ? <ConvexProvider client={convex}>{children}</ConvexProvider> : <>{children}</>;
}
