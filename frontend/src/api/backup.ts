export async function downloadBackup(): Promise<void> {
  const res = await fetch("/api/backup", { credentials: "same-origin" });
  if (!res.ok) throw new Error("descărcarea backup-ului a eșuat");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "karaoke-backup.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<{ imported: number }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/backup/import", {
    method: "POST",
    headers: { "X-Requested-With": "fetch" },
    credentials: "same-origin",
    body: fd,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail) message = body.detail;
    } catch {
      // keep statusText
    }
    throw new Error(message);
  }
  return res.json();
}
