"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, clearCsrfTokenCache } from "@/src/lib/api/client";
import type { ApiError } from "@/src/lib/api/types";
import { routeForRole } from "@/src/features/auth/roleRoutes";
import * as React from "react";
import {
  HoExportRegistryContext,
  type HoExportFormat,
  type HoPageExporter,
} from "@/src/features/shared/exports/hoExport";

type Me = {
  id: number;
  username: string;
  role: "CM" | "FM" | "MR" | string;
  mustChangePassword: boolean;
};

function isApiErrorLike(x: unknown): x is ApiError {
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as any).status === "number" &&
    typeof (x as any).code === "string" &&
    typeof (x as any).message === "string"
  );
}

function isRole(x: string): x is "CM" | "FM" | "MR" {
  return x === "CM" || x === "FM" || x === "MR";
}

type NavItem = { href: string; label: string };
type NavSection = { title: string; items: NavItem[] };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

// Prevent double-rendering the entire shell when legacy pages (which also use AppShell)
// are mounted under App Router layouts that already wrap with AppShell.
const ShellContext = createContext(false);

export default function AppShell({
  title,
  allowedRoles,
  children,
}: {
  title?: string;
  allowedRoles?: Array<"CM" | "FM" | "MR">;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const inShell = useContext(ShellContext);
  const [me, setMe] = useState<Me | null>(null);
  const [meErr, setMeErr] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // HO page export bridge (Phase 2):
  // Pages register their own exporter so shell UI stays stable even when page CSS/layout changes.
  const [hoExporter, setHoExporter] = useState<HoPageExporter | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  // Backend reports endpoints are CM-only in SecurityConfig (Phase 1).
  const canUseReportsExport = me?.role === "CM";
  const supportedFormats = hoExporter?.formats ?? ["csv", "pdf"];
  const supportsCsv = supportedFormats.includes("csv");
  const supportsPdf = supportedFormats.includes("pdf");

  const runHoExport = async (format: HoExportFormat) => {
    if (!canUseReportsExport) {
      setExportErr("Export is available only for CM users.");
      return;
    }
    if (!hoExporter) {
      setExportErr("Export is not available on this page yet.");
      return;
    }

    try {
      setExportErr(null);
      setExportBusy(true);
      await hoExporter.onExport(format);
      setExportMenuOpen(false);
    } catch (e: any) {
      setExportErr(
        typeof e?.message === "string" && e.message.trim()
          ? e.message
          : "Export failed.",
      );
    } finally {
      setExportBusy(false);
    }
  };

  useEffect(() => {
    if (inShell) {
      // Nested AppShell: do NOT refetch /me, do NOT redirect, and do NOT render
      // another topbar/sidebar. Just render title+children.
      setBooting(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const m = await apiFetch<Me>("/me", {
          method: "GET",
          requireCsrf: false,
        });
        if (!alive) return;
        setMe(m);
        setMeErr(null);

        // Password-change gate (matches AuthGuard behavior)
        if (m.mustChangePassword && pathname !== "/change-password") {
          router.replace("/change-password");
          return;
        }

        // Optional role gate (used by /ho and /rep layouts)
        if (allowedRoles && allowedRoles.length > 0) {
          if (!allowedRoles.includes(m.role as any)) {
            if (isRole(m.role)) router.replace(routeForRole(m.role));
            else router.replace("/login");
            return;
          }
        }
      } catch (e) {
        if (!alive) return;
        setMe(null);
        if (isApiErrorLike(e)) setMeErr(`${e.status} ${e.code}: ${e.message}`);
        else setMeErr("Not logged in");
        router.replace("/login");
        return;
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [allowedRoles, inShell, pathname, router]);

  useEffect(() => {
    setExportMenuOpen(false);
    setExportErr(null);

    // Prevent stale exporter from previous page if a page forgets to unregister.
    // New page can register its own exporter after mount.
    setHoExporter(null);
  }, [pathname]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuOpen) return;
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  async function logout() {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } finally {
      clearCsrfTokenCache();
      window.location.href = "/login";
    }
  }

  function initialsFromUsername(u: string) {
    const base = u.split("@")[0] ?? u;
    const parts = base
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return "U";
  }

  const nav: NavSection[] = useMemo(() => {
    const role = me?.role ?? "";

    // One unified sidebar like the prototype:
    // - Dashboards (Company Overview)
    // - Detail Views (Doctor/Rep/Product/Chemist)
    // - Admin (master data) visible ONLY to CM
    const dashboards: NavSection = {
      title: "Dashboards",
      items: [{ href: "/ho/overview", label: "Company Overview" }],
    };

    const details: NavSection = {
      title: "Detail Views",
      items: [
        { href: "/ho/doctors", label: "Doctor Detail" },
        { href: "/ho/reps", label: "Rep Detail" },
        { href: "/ho/products", label: "Product Detail" },
        { href: "/ho/chemists", label: "Chemist Detail" },
      ],
    };

    if (role === "CM") {
      return [
        dashboards,
        details,
        {
          title: "Admin (CM)",
          items: [
            { href: "/admin/doctors", label: "Admin \u2013 Doctors" },
            { href: "/admin/chemists", label: "Admin \u2013 Chemists" },
            { href: "/admin/products", label: "Admin \u2013 Products" },
            // Keep the rest available (MVP ops), but lower in the list
            { href: "/admin/territories", label: "Territories" },
            { href: "/admin/routes", label: "Routes" },
            { href: "/admin/doctor-routes", label: "Doctor\u2013Route map" },
            { href: "/admin/assignments", label: "Assignments" },
          ],
        },
      ];
    }

    if (role === "FM") {
      return [dashboards, details];
    }

    if (role === "MR") {
      return [
        {
          title: "Field App",
          items: [
            { href: "/rep", label: "Home" },
            { href: "/rep/todo", label: "To-do" },
            { href: "/rep/dcr", label: "DCR submissions" },
            { href: "/rep/mileage", label: "Mileage" },
            { href: "/rep/expense", label: "Expenses" },
            { href: "/rep/chemist", label: "Chemist (OOS)" },
          ],
        },
      ];
    }

    // Unknown role / unauth: minimal nav (still show while booting)
    return [
      {
        title: "Navigation",
        items: [
          { href: "/login", label: "Login" },
          { href: "/admin", label: "Admin (CM)" },
          { href: "/ho", label: "Head Office" },
          { href: "/rep", label: "Rep" },
        ],
      },
    ];
  }, [me?.role]);
  const avatarText = me ? initialsFromUsername(me.username) : "…";

  // Nested shell: only render the inner content (no topbar/sidebar).
  if (inShell) {
    return (
      <>
        {title ? (
          <div className="mb-4 text-xl font-semibold">{title}</div>
        ) : null}
        {children}
      </>
    );
  }

  // Sidebar uses prototype CSS classes (side-nav-*, is-active)
  const Sidebar = (
    <div className="flex h-full flex-col">
      {nav.map((sec) => (
        <div key={sec.title}>
          <div className="side-nav-title">{sec.title}</div>
          <div className="flex flex-col gap-1">
            {sec.items.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={["side-nav-item", active ? "is-active" : ""]
                    .join(" ")
                    .trim()}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="side-nav-dot" />
                  <span className="side-nav-label">{it.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div className="mt-8">
        <div className="side-nav-title">Account</div>
        <Link
          href="/me"
          className={[
            "side-nav-item",
            isActive(pathname, "/me") ? "is-active" : "",
          ]
            .join(" ")
            .trim()}
          onClick={() => setSidebarOpen(false)}
        >
          <span className="side-nav-dot" />
          <span className="side-nav-label">Profile</span>
        </Link>
        <Link
          href="/change-password"
          className={[
            "side-nav-item",
            isActive(pathname, "/change-password") ? "is-active" : "",
          ]
            .join(" ")
            .trim()}
          onClick={() => setSidebarOpen(false)}
        >
          <span className="side-nav-dot" />
          <span className="side-nav-label">Change password</span>
        </Link>
        {me ? (
          <button type="button" onClick={logout} className="side-nav-item">
            <span className="side-nav-dot" />
            <span className="side-nav-label">Logout</span>
          </button>
        ) : (
          <Link
            href="/login"
            className={[
              "side-nav-item",
              isActive(pathname, "/login") ? "is-active" : "",
            ]
              .join(" ")
              .trim()}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="side-nav-dot" />
            <span className="side-nav-label">Login</span>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <ShellContext.Provider value={true}>
      <HoExportRegistryContext.Provider value={setHoExporter}>
        <div className="app min-h-screen bg-zinc-50 text-zinc-900">
          {/* Top bar (prototype-like) */}
          <header className="top-bar sticky top-0 z-40 border-b border-zinc-200 bg-white">
            <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-zinc-100 md:hidden"
                  aria-label="Open menu"
                >
                  <span className="text-lg leading-none">≡</span>
                </button>
                <div className="h-8 w-8 rounded-lg bg-violet-600" />
                <Link href="/" className="text-lg font-semibold tracking-tight">
                  Repnexa Dashboards
                </Link>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  {/* Keep data-export-* attributes stable; styling may change, behavior should not. */}
                  <button
                    type="button"
                    data-export-trigger="ho"
                    className={[
                      "h-9 rounded-full border border-zinc-200 bg-white px-4 text-sm hover:bg-zinc-50",
                      !canUseReportsExport || exportBusy
                        ? "cursor-not-allowed opacity-60"
                        : "",
                    ]
                      .join(" ")
                      .trim()}
                    disabled={!canUseReportsExport || exportBusy}
                    onClick={() => {
                      if (!canUseReportsExport || exportBusy) return;
                      setExportErr(null);
                      setExportMenuOpen((v) => !v);
                    }}
                    aria-haspopup="menu"
                    aria-expanded={exportMenuOpen}
                    aria-label="Export report"
                  >
                    {exportBusy ? "Exporting..." : "Export"}
                  </button>

                  {exportMenuOpen && (
                    <div
                      data-export-menu="ho"
                      className="absolute right-0 mt-2 w-64 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg"
                      role="menu"
                      aria-label="Export options"
                    >
                      <div className="px-2 py-1 text-xs text-zinc-500">
                        {canUseReportsExport
                          ? hoExporter?.label
                            ? `Page: ${hoExporter.label}`
                            : "Select a format"
                          : "CM only"}
                      </div>

                      {supportsCsv ? (
                        <button
                          type="button"
                          className="mt-1 block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => void runHoExport("csv")}
                          disabled={
                            exportBusy || !canUseReportsExport || !hoExporter
                          }
                          role="menuitem"
                        >
                          Export CSV
                        </button>
                      ) : null}

                      {supportsPdf ? (
                        <button
                          type="button"
                          className="mt-1 block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => void runHoExport("pdf")}
                          disabled={
                            exportBusy || !canUseReportsExport || !hoExporter
                          }
                          role="menuitem"
                        >
                          Export PDF
                        </button>
                      ) : null}

                      {!hoExporter && canUseReportsExport ? (
                        <div className="mt-2 rounded-lg bg-zinc-50 px-2 py-2 text-xs text-zinc-600">
                          Export is not wired for this page yet (Phase 3).
                        </div>
                      ) : null}

                      {exportErr ? (
                        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-700">
                          {exportErr}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700"
                    aria-label="Account menu"
                  >
                    {avatarText}
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
                      <div className="px-2 py-2 text-xs text-zinc-500">
                        {me ? (
                          <>
                            Logged in as{" "}
                            <span className="font-medium text-zinc-800">
                              {me.username}
                            </span>{" "}
                            <span className="opacity-70">({me.role})</span>
                          </>
                        ) : (
                          (meErr ?? "…")
                        )}
                      </div>
                      <div className="h-px bg-zinc-100" />
                      <Link
                        href="/me"
                        className="mt-1 block rounded-lg px-2 py-2 text-sm hover:bg-zinc-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        Profile
                      </Link>
                      <Link
                        href="/change-password"
                        className="block rounded-lg px-2 py-2 text-sm hover:bg-zinc-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        Change password
                      </Link>
                      {me ? (
                        <button
                          onClick={logout}
                          className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-zinc-50"
                        >
                          Logout
                        </button>
                      ) : (
                        <Link
                          href="/login"
                          className="block rounded-lg px-2 py-2 text-sm hover:bg-zinc-50"
                          onClick={() => setMenuOpen(false)}
                        >
                          Login
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Mobile drawer */}
          {sidebarOpen ? (
            <div className="fixed inset-0 z-50 md:hidden">
              <div
                className="absolute inset-0 bg-black/30"
                onClick={() => setSidebarOpen(false)}
              />
              <aside className="side-nav absolute left-0 top-0 h-full">
                {Sidebar}
              </aside>
            </div>
          ) : null}

          <div className="layout mx-auto flex max-w-[1400px] gap-6 px-4 py-6">
            <aside className="side-nav hidden md:block">{Sidebar}</aside>

            <main className="dashboard-main min-w-0 flex-1">
              {title ? (
                <div className="mb-4 text-xl font-semibold">{title}</div>
              ) : null}
              {booting ? <div className="p-6">Loading…</div> : children}
            </main>
          </div>
        </div>
      </HoExportRegistryContext.Provider>
    </ShellContext.Provider>
  );
}
