import { motion } from "framer-motion";
import { Mic2 } from "lucide-react";
import { usePlayer } from "../player/PlayerContext";

export default function KaraokeFab({ onClick }: { onClick: () => void }) {
  const { current } = usePlayer();
  if (!current) return null;

  return (
    <motion.button
      onClick={onClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.92 }}
      title="Mod karaoke"
      aria-label="Mod karaoke"
      className="fixed bottom-36 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-spotlight text-white shadow-lg shadow-spotlight/40 transition-colors hover:bg-red-400"
    >
      <Mic2 size={22} />
    </motion.button>
  );
}
