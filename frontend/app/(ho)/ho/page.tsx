import Link from "next/link";

export default function HoLanding() {
  return (
    <div className="rounded border bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h1 className="text-2xl font-semibold tracking-tight">Head Office</h1>
      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
        Dashboards and drilldowns. Access is role-gated for <b>FM</b> and{" "}
        <b>CM</b>; backend enforces data scope.
      </p>

      <div className="mt-4 grid gap-2 text-sm">
        <Link className="underline" href="/ho/overview">
          Company Overview
        </Link>
        <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Drilldowns
        </div>
        <Link className="underline" href="/ho/doctors">
          Doctors
        </Link>
        <Link className="underline" href="/ho/reps">
          Reps
        </Link>
        <Link className="underline" href="/ho/products">
          Products
        </Link>
        <Link className="underline" href="/ho/chemists">
          Chemists
        </Link>
        <Link className="underline" href="/ho/assignments">
          Assignments
        </Link>
      </div>
    </div>
  );
}
