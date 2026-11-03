import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getSettings, patchSettings } from "../api/settings";
import type { Track } from "../api/tracks";
import { PlayerEngine } from "../audio/player";

const engine = new PlayerEngine();

interface PlayerContextValue {
  queue: Track[];
  index: number;
  current: Track | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  instrumental: boolean;
  crossfadeEnabled: boolean;
  crossfadeSeconds: number;
  pitch: number;
  playTrack: (t: Track) => void;
  playQueue: (tracks: Track[], startIndex: number) => void;
  next: () => void;
  prev: () => void;
  togglePlay: () => void;
  seek: (t: number) => void;
  toggleInstrumental: () => void;
  toggleCrossfade: () => void;
  setCrossfadeSeconds: (s: number) => void;
  changePitch: (semitones: number) => void;
}

const Ctx = createContext<PlayerContextValue | null>(null);

function srcFor(t: Track, instrumental: boolean, pitch: number) {
  const base = `/media/${t.id}/${instrumental ? "instrumental" : "original"}`;
  return pitch !== 0 ? `${base}?pitch=${pitch}` : base;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [instrumental, setInstrumental] = useState(true);
  const [crossfadeEnabled, setCrossfadeEnabledState] = useState(true);
  const [crossfadeSeconds, setCrossfadeSecondsState] = useState(5);
  const [pitch, setPitch] = useState(0);

  const current = index >= 0 && index < queue.length ? queue[index] : null;

  // screen wake lock while playing (so the display doesn't sleep mid-song)
  useEffect(() => {
    if (!playing) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    nav.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, [playing]);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setCrossfadeEnabledState(s.crossfade_enabled);
        setCrossfadeSecondsState(s.crossfade_seconds);
      })
      .catch(() => {});
  }, []);

  const playTrack = useCallback((t: Track) => {
    setQueue([t]);
    setIndex(0);
    setDuration(t.duration ?? 0);
    setPlaying(true);
    void engine.play(srcFor(t, true, 0));
  }, []);

  const playQueue = useCallback(
    (tracks: Track[], startIndex: number) => {
      setQueue(tracks);
      setIndex(startIndex);
      const t = tracks[startIndex];
      if (t) {
        setDuration(t.duration ?? 0);
        setPlaying(true);
        void engine.play(srcFor(t, instrumental, pitch));
      }
    },
    [instrumental, pitch],
  );

  const next = useCallback(() => {
    if (index < 0) return;
    const ni = index + 1;
    if (ni >= queue.length) {
      setPlaying(false);
      return;
    }
    const t = queue[ni];
    setDuration(t.duration ?? 0);
    setIndex(ni);
    setPlaying(true);
    if (crossfadeEnabled) {
      void engine.crossfadeTo(srcFor(t, instrumental, pitch), crossfadeSeconds);
    } else {
      void engine.play(srcFor(t, instrumental, pitch));
    }
  }, [index, queue, crossfadeEnabled, crossfadeSeconds, instrumental, pitch]);

  const prev = useCallback(() => {
    if (index < 0) return;
    if (engine.currentTime > 3 || index === 0) {
      engine.seek(0);
      setCurrentTime(0);
      return;
    }
    const ni = index - 1;
    const t = queue[ni];
    setIndex(ni);
    setDuration(t.duration ?? 0);
    setPlaying(true);
    void engine.play(srcFor(t, instrumental, pitch));
  }, [index, queue, instrumental, pitch]);

  const togglePlay = useCallback(() => {
    if (!current) return;
    if (playing) {
      engine.pause();
      setPlaying(false);
    } else {
      setPlaying(true);
      void engine.resume();
    }
  }, [current, playing]);

  const seek = useCallback((t: number) => {
    engine.seek(t);
    setCurrentTime(t);
  }, []);

  const toggleInstrumental = useCallback(() => {
    const nv = !instrumental;
    setInstrumental(nv);
    if (current) {
      const time = engine.currentTime;
      void engine.play(srcFor(current, nv, pitch)).then(() => engine.seek(time));
    }
  }, [instrumental, current, pitch]);

  const toggleCrossfade = useCallback(() => {
    const nv = !crossfadeEnabled;
    setCrossfadeEnabledState(nv);
    void patchSettings({ crossfade_enabled: nv }).catch(() => {});
  }, [crossfadeEnabled]);

  const setCrossfadeSeconds = useCallback((s: number) => {
    setCrossfadeSecondsState(s);
    void patchSettings({ crossfade_seconds: s }).catch(() => {});
  }, []);

  const changePitch = useCallback(
    (n: number) => {
      setPitch(n);
      if (current) {
        const time = engine.currentTime;
        void engine.play(srcFor(current, instrumental, n)).then(() =>
          engine.seek(time),
        );
      }
    },
    [current, instrumental],
  );

  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  });

  useEffect(() => {
    engine.onTime = (t) => setCurrentTime(t);
    engine.onEnded = () => {
      if (!crossfadeEnabled) nextRef.current();
    };
    engine.onCrossfade = () => nextRef.current();
    engine.setFade(crossfadeEnabled ? crossfadeSeconds : 0);
    return () => {
      engine.onTime = null;
      engine.onEnded = null;
      engine.onCrossfade = null;
    };
  }, [crossfadeEnabled, crossfadeSeconds]);

  return (
    <Ctx.Provider
      value={{
        queue,
        index,
        current,
        playing,
        currentTime,
        duration,
        instrumental,
        crossfadeEnabled,
        crossfadeSeconds,
        pitch,
        playTrack,
        playQueue,
        next,
        prev,
        togglePlay,
        seek,
        toggleInstrumental,
        toggleCrossfade,
        setCrossfadeSeconds,
        changePitch,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayer trebuie folosit în interiorul PlayerProvider");
  return ctx;
}
