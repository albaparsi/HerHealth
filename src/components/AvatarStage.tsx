"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import type { AvatarHandle } from "./Avatar";

const Avatar = dynamic(() => import("./Avatar"), { ssr: false });

export default function AvatarStage() {
  const avatar = useRef<AvatarHandle>(null);

  return (
    <div className="flex flex-col gap-3">
      <Avatar
        ref={avatar}
        className="aspect-square w-full overflow-hidden rounded-3xl bg-gradient-to-b from-blush to-cream"
      />
      {/* Temporary: tests the lip-sync hook until Cartesia audio drives it in Step 5. */}
      <label className="flex items-center gap-3 text-xs text-plum/60">
        Mouth test
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          defaultValue={0}
          onChange={(e) => avatar.current?.setMouthOpen(Number(e.target.value))}
          className="flex-1 accent-rose"
        />
      </label>
    </div>
  );
}
