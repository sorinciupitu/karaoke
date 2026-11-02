import { api } from "./client";

export interface User {
  id: number;
  username: string;
  is_admin: boolean;
}

export function listUsers(): Promise<User[]> {
  return api<User[]>("/api/users");
}

export function createUser(username: string, password: string): Promise<User> {
  return api<User>("/api/users", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function deleteUser(id: number): Promise<void> {
  return api<void>(`/api/users/${id}`, { method: "DELETE" });
}
