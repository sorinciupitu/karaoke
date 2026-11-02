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
  playTrack: (t: Track) => void;
  playQueue: (tracks: Track[], startIndex: number) => void;
  next: () => void;
  prev: () => void;
  togglePlay: () => void;
  seek: (t: number) => void;
  toggleInstrumental: () => void;
  toggleCrossfade: () => void;
  setCrossfadeSeconds: (s: number) => void;
}

const Ctx = createContext<PlayerContextValue | null>(null);

function srcFor(t: Track, instrumental: boolean) {
  return `/media/${t.id}/${instrumental ? "instrumental" : "original"}`;
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

  const current = index >= 0 && index < queue.length ? queue[index] : null;

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
    void engine.play(srcFor(t, true));
  }, []);

  const playQueue = useCallback(
    (tracks: Track[], startIndex: number) => {
      setQueue(tracks);
      setIndex(startIndex);
      const t = tracks[startIndex];
      if (t) {
        setDuration(t.duration ?? 0);
        setPlaying(true);
        void engine.play(srcFor(t, instrumental));
      }
    },
    [instrumental],
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
      void engine.crossfadeTo(srcFor(t, instrumental), crossfadeSeconds);
    } else {
      void engine.play(srcFor(t, instrumental));
    }
  }, [index, queue, crossfadeEnabled, crossfadeSeconds, instrumental]);

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
    void engine.play(srcFor(t, instrumental));
  }, [index, queue, instrumental]);

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
      void engine.play(srcFor(current, nv)).then(() => engine.seek(time));
    }
  }, [instrumental, current]);

  const toggleCrossfade = useCallback(() => {
    const nv = !crossfadeEnabled;
    setCrossfadeEnabledState(nv);
    void patchSettings({ crossfade_enabled: nv }).catch(() => {});
  }, [crossfadeEnabled]);

  const setCrossfadeSeconds = useCallback((s: number) => {
    setCrossfadeSecondsState(s);
    void patchSettings({ crossfade_seconds: s }).catch(() => {});
  }, []);

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
        playTrack,
        playQueue,
        next,
        prev,
        togglePlay,
        seek,
        toggleInstrumental,
        toggleCrossfade,
        setCrossfadeSeconds,
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
