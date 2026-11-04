export function statusLabel(status: string, lyrics_status: string): string {
  if (status === "failed") return "eroare";
  if (status === "ready") {
    if (lyrics_status === "syncing" || lyrics_status === "pending")
      return "gata · se transcriu versurile";
    if (lyrics_status === "failed") return "gata · fără versuri";
    return "gata";
  }
  if (status === "queued") return "în așteptare";
  if (status === "downloading") return "se descarcă";
  if (status === "separating") {
    return lyrics_status === "syncing" ? "se transcriu versurile" : "se separă vocea";
  }
  if (status === "encoding") return "se codifică";
  return status;
}

export function statusTone(status: string): string {
  if (status === "ready") return "text-emerald-400";
  if (status === "failed") return "text-red-400";
  return "text-spotlight";
}
