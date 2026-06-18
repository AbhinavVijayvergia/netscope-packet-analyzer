/**
 * api.js — Backend REST API client
 */

const BASE = "/api";

export async function fetchInterfaces() {
  const r = await fetch(`${BASE}/interfaces`);
  if (!r.ok) throw new Error("Failed to fetch interfaces");
  return r.json();
}

export async function startCapture(iface) {
  const r = await fetch(`${BASE}/capture/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interface: iface }),
  });
  return r.json();
}

export async function stopCapture() {
  const r = await fetch(`${BASE}/capture/stop`, { method: "POST" });
  return r.json();
}

export async function fetchDashboard() {
  const r = await fetch(`${BASE}/dashboard`);
  if (!r.ok) throw new Error("Dashboard fetch failed");
  return r.json();
}

export async function uploadPcap(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("file", file);

    xhr.open("POST", `${BASE}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new Error("Invalid response"));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(fd);
  });
}
