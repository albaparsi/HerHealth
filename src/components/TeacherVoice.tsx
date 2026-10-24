"use client";

import { useAction } from "convex/react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { api } from "../../convex/_generated/api";
import type { AvatarHandle } from "./Avatar";

/**
 * Speaks the teacher's caption with Cartesia and drives the avatar's mouth from the audio level.
 * She speaks on her own when the browser allows it (e.g. after clicking a lesson card). If the browser
 * blocks audio, as on a direct page load, she starts on the learner's first tap.
 */
export default function TeacherVoice({
  caption,
  prefetch,
  avatar,
}: {
  caption: string;
  prefetch: string[];
  avatar: RefObject<AvatarHandle | null>;
}) {
  const speak = useAction(api.speech.speak);
  const urls = useRef(new Map<string, Promise<string>>());
  const audio = useRef<HTMLAudioElement | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const [on, setOn] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const latest = useRef(caption);

  const urlFor = useCallback(
    (text: string) => {
      let p = urls.current.get(text);
      if (!p) {
        p = speak({ text: forSpeech(text) });
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
    // "playing" fires when sound actually starts, unlike "play", which fires while the file is still loading.
    el.addEventListener("playing", () => setPlaying(true));
    el.addEventListener("waiting", () => setPlaying(false));
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
        if (el.src !== url) el.src = url;
        await el.play();
        setBlocked(false);
      } catch (e) {
        if ((e as Error).name === "NotAllowedError") setBlocked(true);
        else if ((e as Error).name !== "AbortError") setError("The voice is unavailable right now.");
      }
    },
    [urlFor],
  );

  useEffect(() => {
    latest.current = caption;
    // Deferred so the effect itself never sets state.
    if (on) queueMicrotask(() => play(caption));
    else audio.current?.pause();
  }, [caption, on, play]);

  // Audio was blocked: start speaking on the first tap anywhere.
  useEffect(() => {
    if (!blocked || !on) return;
    const resume = () => play(latest.current);
    window.addEventListener("pointerdown", resume, { once: true });
    return () => window.removeEventListener("pointerdown", resume);
  }, [blocked, on, play]);

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
        if (level > 0) heard = true;
      }
      // Without Web Audio, or if the analyser stays silent well into playback (cross-origin audio),
      // fall back to a talking rhythm. Never before the voice has started.
      const silentTooLong = !heard && (audio.current?.currentTime ?? 0) > 1;
      if (!analyser.current || silentTooLong) level = 0.25 + 0.25 * Math.sin(t / 70) * Math.sin(t / 130);
      avatar.current?.setMouthOpen(level);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, avatar]);

  return (
    <div className="mt-3 flex items-center gap-3 text-xs text-muted">
      <button
        onClick={() => play(caption)}
        className="rounded border border-line bg-surface px-2.5 py-1 text-ink hover:border-accent"
      >
        {playing ? "Speaking…" : "▶ Listen"}
      </button>
      <button onClick={() => setOn((v) => !v)} className="underline-offset-2 hover:underline" aria-pressed={on}>
        Voice {on ? "on" : "off"}
      </button>
      {blocked && on && !playing && <span className="text-accent">Tap anywhere to hear your teacher.</span>}
      {error && <span className="text-alert">{error}</span>}
    </div>
  );
}

/** Spells out numbers that text-to-speech reads the wrong way, e.g. 911 as "nine hundred eleven" or ADHD as a word. */
function forSpeech(text: string) {
  return text.replace(/\b9-?1-?1\b/g, "nine one one").replace(/\bADHD\b/g, "A D H D");
}
