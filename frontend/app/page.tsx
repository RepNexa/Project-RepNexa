"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { me } from "@/src/features/auth/api";
import { routeForRole } from "@/src/features/auth/roleRoutes";
import Image from "next/image"; 

type PortalCardProps = {
  title: string;
  description: string;
  bullets: string[];
  href: string;
  buttonLabel: string;
  badge: string;
  icon: string;
};

function PortalCard({
  title,
  description,
  bullets,
  href,
  buttonLabel,
  badge,
  icon,
}: PortalCardProps) {
  return (
    <div className="rounded-[32px] border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-7">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-2xl text-violet-700 shadow-sm">
          {icon}
        </div>

        <div className="min-w-0">
          <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700 sm:text-xs">
            {badge}
          </div>
          <div className="mt-3 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
            {title}
          </div>
          <div className="mt-2 text-sm leading-6 text-zinc-600">
            {description}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {bullets.map((item) => (
          <div key={item} className="flex items-start gap-3 text-sm text-zinc-700">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
            <span className="leading-6">{item}</span>
          </div>
        ))}
      </div>

      <div className="mt-7">
        <Link
          href={href}
          className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700"
        >
          {buttonLabel}
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const m = await me();
        if (!alive) return;

        if (m.mustChangePassword) {
          router.replace("/change-password");
          return;
        }

        router.replace(routeForRole(m.role));
      } catch {
        if (!alive) return;
        setCheckingSession(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f6f1ff_0%,#f8f5ff_42%,#ffffff_100%)] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex min-h-[80vh] max-w-6xl items-center justify-center">
          <div className="rounded-[28px] border border-zinc-200 bg-white px-6 py-5 text-sm text-zinc-600 shadow-sm sm:px-8">
            Checking session...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f1ff_0%,#f8f5ff_42%,#ffffff_100%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center">
  <Image
    src="/repnexa_logo.svg"
    alt="Repnexa"
    width={170}
    height={44}
    className="h-10 w-auto object-contain sm:h-11"
    priority
  />
</Link>

          <div className="inline-flex w-fit rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-sm text-zinc-600 backdrop-blur">
            Pharma Management System
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-4xl text-center sm:mt-16">
          <div className="text-3xl font-semibold tracking-tight text-violet-700 sm:text-5xl">
            Pharma Management System
          </div>
          <div className="mx-auto mt-4 max-w-3xl text-base leading-8 text-zinc-600 sm:text-lg">
           {"Track with precision. Cover with confidence. Perform with impact"}
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2 xl:mt-14">
          <PortalCard
            title="Medical Representative"
            description=""
            bullets={[
              "Track doctor visits and daily call reports",
              "Log chemist stock issues and pharmacy interactions",
              "Submit mileage and manage field activity quickly",
              "Review to-do priorities for assigned routes",
            ]}
            href="/login?portal=mr"
            buttonLabel="Enter Rep Portal"
            badge="Field App"
            icon="👨‍⚕️"
          />

          <PortalCard
            title="Head Office / Company Manager"
            description=""
            bullets={[
              "Manage doctors, chemists, routes, and territories",
              "Control assignments and operational structure",
              "Review dashboards, drilldowns, and performance data",
              "Open the management workspace for administration",
            ]}
            href="/login?portal=ho"
            buttonLabel="Enter HO Portal"
            badge="Management"
            icon="🏢"
          />
        </div>

        <div className="mt-10 pb-4 text-center text-sm text-zinc-500 sm:mt-14">
          Professional pharmaceutical management platform for efficient
          operations.
        </div>
      </div>
    </div>
  );
}
