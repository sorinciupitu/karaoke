import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Line } from "../api/tracks";
import { findActiveLineIndex } from "../audio/lyricsSync";
import { usePlayer } from "../player/PlayerContext";

export default function LyricsView({
  lines,
  live = true,
}: {
  lines: Line[];
  live?: boolean;
}) {
  const { currentTime } = usePlayer();
  const active = live ? findActiveLineIndex(lines, currentTime) : -1;
  const activeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active]);

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const isActive = i === active;
        return (
          <motion.p
            key={i}
            ref={isActive ? activeRef : undefined}
            animate={{ scale: isActive ? 1.04 : 1, x: isActive ? 8 : 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className={`origin-left text-2xl font-medium leading-snug transition-colors duration-200 ${
              isActive
                ? "text-spotlight drop-shadow-[0_0_18px_rgba(255,194,75,0.35)]"
                : "text-cream/40"
            }`}
          >
            {line.text}
          </motion.p>
        );
      })}
    </div>
  );
}
