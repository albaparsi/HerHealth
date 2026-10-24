"use client";

import { useAction } from "convex/react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { api } from "../../convex/_generated/api";
import type { AvatarHandle } from "./Avatar";

/**
 * Speaks the teacher's caption with Cartesia and drives the avatar's mouth from the audio level.
 * Browsers only allow audio after a user gesture, so nothing plays until the learner clicks something.
 */
export default function TeacherVoice({
  caption,
  prefetch,
  avatar,
  interacted,
}: {
  caption: string;
  prefetch: string[];
  avatar: RefObject<AvatarHandle | null>;
  interacted: boolean;
}) {
  const speak = useAction(api.speech.speak);
  const urls = useRef(new Map<string, Promise<string>>());
  const audio = useRef<HTMLAudioElement | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const [on, setOn] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlFor = useCallback(
    (text: string) => {
      let p = urls.current.get(text);
      if (!p) {
        p = speak({ text });
        p.catch(() => urls.current.delete(text));
        urls.current.set(text, p);
      }
      return p;
    },
    [speak],
  );

  // Warm the cache one line at a time (Cartesia limits concurrent requests), so each step's
  // audio is ready when the learner gets there.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const line of prefetch) {
        if (cancelled) return;
        await urlFor(line).catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefetch, urlFor]);

  const ensureAudio = () => {
    if (audio.current) return audio.current;
    const el = new Audio();
    el.crossOrigin = "anonymous";
    try {
      const ctx = new AudioContext();
      const node = ctx.createAnalyser();
      node.fftSize = 1024;
      ctx.createMediaElementSource(el).connect(node);
      node.connect(ctx.destination);
      analyser.current = node;
      el.addEventListener("play", () => ctx.resume());
    } catch {
      // No Web Audio: the mouth falls back to a simple talking motion below.
    }
    el.addEventListener("play", () => setPlaying(true));
    el.addEventListener("pause", () => setPlaying(false));
    el.addEventListener("ended", () => setPlaying(false));
    audio.current = el;
    return el;
  };

  const play = useCallback(
    async (text: string) => {
      try {
        const url = await urlFor(text);
        setError(null);
        const el = ensureAudio();
        el.src = url;
        await el.play();
      } catch (e) {
        setError((e as Error).message.includes("play") ? null : "The voice is unavailable right now.");
      }
    },
    [urlFor],
  );

  useEffect(() => {
    // Deferred so the effect itself never sets state.
    if (on && interacted) queueMicrotask(() => play(caption));
    else audio.current?.pause();
  }, [caption, on, interacted, play]);

  // Lip sync: RMS of the playing audio opens the mouth.
  useEffect(() => {
    if (!playing) {
      avatar.current?.setMouthOpen(0);
      return;
    }
    const buf = new Uint8Array(1024);
    let frame = 0;
    let heard = false;
    const tick = (t: number) => {
      let level = 0;
      if (analyser.current) {
        analyser.current.getByteTimeDomainData(buf);
        let sum = 0;
        for (const b of buf) sum += ((b - 128) / 128) ** 2;
        level = Math.min(1, Math.max(0, (Math.sqrt(sum / buf.length) - 0.02) * 7));
        if (sum > 0) heard = true;
      }
      // Cross-origin audio can leave the analyser silent; fake a talking rhythm instead.
      if (!heard) level = 0.25 + 0.25 * Math.sin(t / 70) * Math.sin(t / 130);
      avatar.current?.setMouthOpen(level);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, avatar]);

  return (
    <div className="mt-3 flex items-center gap-3 text-xs text-white/60">
      <button
        onClick={() => play(caption)}
        className="rounded border border-white/20 px-2.5 py-1 text-white/80 hover:bg-white/10"
      >
        {playing ? "Speaking…" : "▶ Listen"}
      </button>
      <button onClick={() => setOn((v) => !v)} className="underline-offset-2 hover:underline" aria-pressed={on}>
        Voice {on ? "on" : "off"}
      </button>
      {error && <span className="text-red-300">{error}</span>}
    </div>
  );
}
