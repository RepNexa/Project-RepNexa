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
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [hoExporter, setHoExporter] = useState<HoPageExporter | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  // Backend report generation is CM-only for now.
  const canUseReportsExport = me?.role === "CM";
  const supportedFormats = hoExporter?.formats ?? ["csv", "pdf"];
  const supportsCsv = supportedFormats.includes("csv");
  const supportsPdf = supportedFormats.includes("pdf");

  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
    setExportMenuOpen(false);
    setExportErr(null);

    // Avoid carrying a previous page's exporter into the next route.
    setHoExporter(null);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  function onHamburgerClick() {
    setSidebarOpen((v) => !v);
  }

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

        if (m.mustChangePassword && pathname !== "/change-password") {
          router.replace("/change-password");
          return;
        }

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
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;

      if (menuOpen && menuRef.current && !menuRef.current.contains(t)) {
        setMenuOpen(false);
      }

      if (
        exportMenuOpen &&
        exportMenuRef.current &&
        !exportMenuRef.current.contains(t)
      ) {
        setExportMenuOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSidebarOpen(false);
        setExportMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [exportMenuOpen, menuOpen]);

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
            { href: "/admin/doctors", label: "Admin – Doctors" },
            { href: "/admin/chemists", label: "Admin – Chemists" },
            { href: "/admin/products", label: "Admin – Products" },
            { href: "/admin/territories", label: "Territories" },
            { href: "/admin/routes", label: "Routes" },
            { href: "/admin/doctor-routes", label: "Doctor–Route map" },
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
            { href: "/rep/chemist", label: "Chemist (OOS)" },
          ],
        },
      ];
    }

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

  if (inShell) {
    return (
      <>
        {title ? (
          <div className="mb-4 text-lg font-semibold sm:text-xl">{title}</div>
        ) : null}
        {children}
      </>
    );
  }

  const navItemClass = (active: boolean) =>
    [
      "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all",
      active
        ? "bg-violet-100 text-violet-700"
        : "text-zinc-700 hover:bg-violet-50 hover:text-violet-700",
    ].join(" ");

  const DrawerContent = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-violet-100 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-sm font-semibold text-white shadow-sm">
            {avatarText}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-900">
              {me?.username ?? "Repnexa"}
            </div>
            <div className="text-xs text-zinc-500">
              {me?.role ?? meErr ?? "…"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          aria-label="Close navigation"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        <div className="space-y-6">
          {nav.map((sec) => (
            <div key={sec.title}>
              <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {sec.title}
              </div>

              <div className="space-y-1">
                {sec.items.map((it) => {
                  const active = isActive(pathname, it.href);
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      title={it.label}
                      className={navItemClass(active)}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span
                        className={[
                          "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                          active
                            ? "bg-violet-600"
                            : "bg-zinc-300 group-hover:bg-violet-400",
                        ].join(" ")}
                      />
                      <span className="truncate">{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-zinc-100 pt-6">
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Account
          </div>

          <div className="space-y-1">
            <Link
              href="/me"
              title="Profile"
              className={navItemClass(isActive(pathname, "/me"))}
              onClick={() => setSidebarOpen(false)}
            >
              <span
                className={[
                  "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                  isActive(pathname, "/me") ? "bg-violet-600" : "bg-zinc-300",
                ].join(" ")}
              />
              <span className="truncate">Profile</span>
            </Link>

            <Link
              href="/change-password"
              title="Change password"
              className={navItemClass(isActive(pathname, "/change-password"))}
              onClick={() => setSidebarOpen(false)}
            >
              <span
                className={[
                  "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                  isActive(pathname, "/change-password")
                    ? "bg-violet-600"
                    : "bg-zinc-300",
                ].join(" ")}
              />
              <span className="truncate">Change password</span>
            </Link>

            {me ? (
              <button
                type="button"
                onClick={logout}
                className="group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-zinc-700 transition-all hover:bg-red-50 hover:text-red-700"
                title="Logout"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-300 transition-colors group-hover:bg-red-400" />
                <span className="truncate">Logout</span>
              </button>
            ) : (
              <Link
                href="/login"
                title="Login"
                className={navItemClass(isActive(pathname, "/login"))}
                onClick={() => setSidebarOpen(false)}
              >
                <span
                  className={[
                    "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
                    isActive(pathname, "/login")
                      ? "bg-violet-600"
                      : "bg-zinc-300",
                  ].join(" ")}
                />
                <span className="truncate">Login</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ShellContext.Provider value={true}>
      <HoExportRegistryContext.Provider value={setHoExporter}>
        <div className="min-h-screen bg-violet-50/40 text-zinc-900">
          <header className="sticky top-0 z-40 border-b border-violet-100 bg-white/90 backdrop-blur">
            <div className="flex min-h-[56px] w-full items-center justify-between gap-3 px-3 sm:min-h-[60px] sm:px-4 lg:px-6">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={onHamburgerClick}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-700 transition-colors hover:bg-violet-50 hover:text-violet-700"
                  aria-label="Toggle navigation"
                >
                  <span className="text-lg leading-none">≡</span>
                </button>

                <div className="h-9 w-9 shrink-0 rounded-2xl bg-violet-600 shadow-sm" />

                <Link
                  href="/"
                  className="min-w-0 truncate text-sm font-semibold tracking-tight sm:text-base lg:text-lg"
                >
                  Repnexa Dashboards
                </Link>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <div className="relative hidden sm:block" ref={exportMenuRef}>
                  <button
                    type="button"
                    data-export-trigger="ho"
                    className={[
                      "h-9 items-center rounded-full border border-violet-200 bg-white px-4 text-sm text-zinc-700 transition-colors hover:bg-violet-50 sm:inline-flex",
                      !canUseReportsExport || exportBusy
                        ? "cursor-not-allowed opacity-60"
                        : "",
                    ].join(" ")}
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
                      className="absolute right-0 mt-2 w-64 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg"
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
                          className="mt-1 block w-full rounded-xl px-2 py-2 text-left text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                          className="mt-1 block w-full rounded-xl px-2 py-2 text-left text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                        <div className="mt-2 rounded-xl bg-zinc-50 px-2 py-2 text-xs text-zinc-600">
                          Export is not wired for this page yet.
                        </div>
                      ) : null}

                      {exportErr ? (
                        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-700">
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
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700"
                    aria-label="Account menu"
                  >
                    {avatarText}
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg">
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
                        className="mt-1 block rounded-xl px-2 py-2 text-sm hover:bg-zinc-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        Profile
                      </Link>

                      <Link
                        href="/change-password"
                        className="block rounded-xl px-2 py-2 text-sm hover:bg-zinc-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        Change password
                      </Link>

                      {me ? (
                        <button
                          onClick={logout}
                          className="block w-full rounded-xl px-2 py-2 text-left text-sm hover:bg-zinc-50"
                        >
                          Logout
                        </button>
                      ) : (
                        <Link
                          href="/login"
                          className="block rounded-xl px-2 py-2 text-sm hover:bg-zinc-50"
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

          {sidebarOpen ? (
            <div className="fixed inset-0 z-50">
              <div
                className="absolute inset-0 bg-zinc-900/35"
                onClick={() => setSidebarOpen(false)}
              />
              <aside className="absolute left-0 top-0 h-full w-[76vw] max-w-[280px] shadow-2xl sm:max-w-[300px]">
                {DrawerContent}
              </aside>
            </div>
          ) : null}

          <main className="min-w-0 px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
            {title ? (
              <div className="mb-4 text-lg font-semibold sm:text-xl">
                {title}
              </div>
            ) : null}

            {booting ? <div className="p-4 sm:p-6">Loading…</div> : children}
          </main>
        </div>
      </HoExportRegistryContext.Provider>
    </ShellContext.Provider>
  );
}
