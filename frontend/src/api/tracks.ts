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
  language: string;
  created_at: string;
}

export function listTracks(): Promise<Track[]> {
  return api<Track[]>("/api/tracks");
}

export function createTrack(youtube_url: string): Promise<Track> {
  return api<Track>("/api/tracks", {
    method: "POST",
    body: JSON.stringify({ youtube_url }),
  });
}

export function deleteTrack(id: number): Promise<void> {
  return api<void>(`/api/tracks/${id}`, { method: "DELETE" });
}
