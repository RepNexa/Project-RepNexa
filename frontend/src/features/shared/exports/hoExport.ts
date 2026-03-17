"use client";

import * as React from "react";

export type HoExportFormat = "csv" | "pdf";

export type HoPageExporter = {
  label: string;
  onExport: (format: HoExportFormat) => Promise<void>;
  formats?: HoExportFormat[];
};

export type HoExportRegistrySetter = (exporter: HoPageExporter | null) => void;

/**
 * AppShell provides this context; pages register/unregister their exporter.
 */
export const HoExportRegistryContext =
  React.createContext<HoExportRegistrySetter | null>(null);

export function useRegisterHoExporter(exporter: HoPageExporter | null) {
  const setExporter = React.useContext(HoExportRegistryContext);

  React.useEffect(() => {
    if (!setExporter) return;
    setExporter(exporter);
    return () => {
      setExporter(null);
    };
  }, [setExporter, exporter]);
}

type DownloadReportArgs = {
  url: string; // POST export endpoint, e.g. /api/v1/reports/company-overview.pdf
  body: unknown;
  fallbackFilename: string;
};

type DownloadGetArgs = {
  url: string; // GET file endpoint, e.g. /api/v1/admin/doctors.csv
  fallbackFilename: string;
};

export async function downloadReportBlob({
  url,
  body,
  fallbackFilename,
}: DownloadReportArgs): Promise<void> {
  const path = normalizePostExportPath(url);
  await postExportDownload({
    path,
    body,
    fallbackFilename,
  });
}

export async function downloadGetBlob({
  url,
  fallbackFilename,
}: DownloadGetArgs): Promise<void> {
  const resolvedUrl = normalizeApiUrl(url);

  const res = await fetch(resolvedUrl, {
    method: "GET",
    credentials: "include",
  });

  await finalizeDownloadResponse(res, fallbackFilename);
}

function normalizePostExportPath(url: string): string {
  if (url.startsWith("/api/v1/")) {
    return url.slice("/api/v1".length);
  }
  if (url.startsWith("/")) {
    return url;
  }
  throw new Error(`Unsupported export URL: ${url}`);
}

function normalizeApiUrl(url: string): string {
  if (url.startsWith("/api/v1/")) return url;
  if (url.startsWith("/")) return `/api/v1${url}`;
  throw new Error(`Unsupported API URL: ${url}`);
}

async function getCsrfToken(): Promise<string> {
  const r = await fetch("/api/v1/auth/csrf", {
    method: "GET",
    credentials: "include",
  });

  if (!r.ok) {
    throw new Error(`CSRF bootstrap failed (${r.status})`);
  }

  const j = (await r.json()) as { token?: string };
  const token = typeof j?.token === "string" ? j.token : "";
  if (!token) {
    throw new Error("CSRF token not returned by /auth/csrf");
  }
  return token;
}

export async function postExportDownload(args: {
  path: string; // e.g. "/reports/company-overview.csv"
  body: unknown;
  fallbackFilename: string;
}) {
  const csrf = await getCsrfToken();

  const res = await fetch(`/api/v1${args.path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf,
    },
    body: JSON.stringify(args.body ?? {}),
  });

  await finalizeDownloadResponse(res, args.fallbackFilename);
}

async function finalizeDownloadResponse(
  res: Response,
  fallbackFilename: string,
): Promise<void> {
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  if (contentType.includes("application/json")) {
    let msg = "Export returned JSON instead of a file.";
    try {
      const err = await res.json();
      if (typeof err?.message === "string" && err.message.trim()) {
        msg = `Export failed: ${err.message}`;
      }
    } catch {
      // ignore parse error
    }
    throw new Error(msg);
  }

  const blob = await res.blob();
  if (!blob.size) {
    throw new Error("Export failed: empty file.");
  }

  const filename =
    parseFilenameFromContentDisposition(
      res.headers.get("content-disposition"),
    ) || fallbackFilename;

  triggerBrowserDownload(blob, filename);
}

async function readErrorMessage(res: Response): Promise<string> {
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();

  try {
    if (contentType.includes("application/json")) {
      const err = await res.json();
      const msg =
        typeof err?.message === "string" && err.message.trim()
          ? err.message
          : typeof err?.detail === "string" && err.detail.trim()
            ? err.detail
            : typeof err?.code === "string" && err.code.trim()
              ? err.code
              : null;

      if (msg) return `Export failed (${res.status}): ${msg}`;
    } else {
      const txt = (await res.text()).trim();
      if (txt) return `Export failed (${res.status}): ${txt}`;
    }
  } catch {
    // keep generic fallback
  }

  return `Export failed (${res.status} ${res.statusText})`;
}

function parseFilenameFromContentDisposition(v: string | null): string | null {
  if (!v) return null;

  const star = v.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return star[1].trim().replace(/^"|"$/g, "");
    }
  }

  const quoted = v.match(/filename\s*=\s*"([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];

  const plain = v.match(/filename\s*=\s*("?)([^";]+)\1/i);
  return plain?.[2] ?? null;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
