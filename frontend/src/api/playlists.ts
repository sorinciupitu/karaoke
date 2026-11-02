import { api } from "./client";
import type { Track } from "./tracks";

export interface Playlist {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
}

export interface PlaylistDetail extends Playlist {
  tracks: Track[];
}

export function listPlaylists(): Promise<Playlist[]> {
  return api<Playlist[]>("/api/playlists");
}

export function getPlaylist(id: number): Promise<PlaylistDetail> {
  return api<PlaylistDetail>(`/api/playlists/${id}`);
}

export function createPlaylist(name: string): Promise<Playlist> {
  return api<Playlist>("/api/playlists", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updatePlaylist(id: number, name: string): Promise<Playlist> {
  return api<Playlist>(`/api/playlists/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deletePlaylist(id: number): Promise<void> {
  return api<void>(`/api/playlists/${id}`, { method: "DELETE" });
}

export function addTrackToPlaylist(
  playlistId: number,
  trackId: number,
): Promise<PlaylistDetail> {
  return api<PlaylistDetail>(`/api/playlists/${playlistId}/tracks`, {
    method: "POST",
    body: JSON.stringify({ track_id: trackId }),
  });
}

export function removeTrackFromPlaylist(
  playlistId: number,
  trackId: number,
): Promise<PlaylistDetail> {
  return api<PlaylistDetail>(`/api/playlists/${playlistId}/tracks/${trackId}`, {
    method: "DELETE",
  });
}

export function reorderPlaylist(
  playlistId: number,
  trackIds: number[],
): Promise<PlaylistDetail> {
  return api<PlaylistDetail>(`/api/playlists/${playlistId}/tracks/order`, {
    method: "PUT",
    body: JSON.stringify({ track_ids: trackIds }),
  });
}
