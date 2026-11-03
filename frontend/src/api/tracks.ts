import { api } from "./client";

export interface Line {
  text: string;
  start: number;
  end: number;
}

export interface Track {
  id: number;
  user_id: number;
  title: string;
  artist: string;
  youtube_url: string;
  youtube_id: string;
  status: string;
  lyrics_status: string;
  error: string | null;
  duration: number | null;
  lyrics: Line[];
  lyrics_source: string | null;
  musical_key: string | null;
  language: string;
  created_at: string;
}

export function listTracks(): Promise<Track[]> {
  return api<Track[]>("/api/tracks");
}

export function getTrack(id: number): Promise<Track> {
  return api<Track>(`/api/tracks/${id}`);
}

export function createTrack(youtube_url: string): Promise<Track> {
  return api<Track>("/api/tracks", {
    method: "POST",
    body: JSON.stringify({ youtube_url }),
  });
}

export interface UploadTrackOptions {
  title?: string;
  artist?: string;
  remove_vocals: boolean;
  lyrics: boolean;
}

export function uploadTrack(file: File, opts: UploadTrackOptions): Promise<Track> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("title", opts.title ?? "");
  fd.append("artist", opts.artist ?? "");
  fd.append("remove_vocals", String(opts.remove_vocals));
  fd.append("lyrics", String(opts.lyrics));
  return api<Track>("/api/tracks/upload", { method: "POST", body: fd });
}

export function updateTrack(
  id: number,
  patch: { title?: string; artist?: string; language?: string },
): Promise<Track> {
  return api<Track>(`/api/tracks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteTrack(id: number): Promise<void> {
  return api<void>(`/api/tracks/${id}`, { method: "DELETE" });
}

export function updateLyrics(id: number, lines: Line[]): Promise<Track> {
  return api<Track>(`/api/tracks/${id}/lyrics`, {
    method: "PUT",
    body: JSON.stringify({ lines }),
  });
}

export function resyncLyrics(id: number): Promise<Track> {
  return api<Track>(`/api/tracks/${id}/lyrics/resync`, { method: "POST" });
}

export function refetchLyrics(id: number): Promise<Track> {
  return api<Track>(`/api/tracks/${id}/lyrics/refetch`, { method: "POST" });
}

export function retryLyrics(id: number): Promise<Track> {
  return api<Track>(`/api/tracks/${id}/lyrics/retry`, { method: "POST" });
}
