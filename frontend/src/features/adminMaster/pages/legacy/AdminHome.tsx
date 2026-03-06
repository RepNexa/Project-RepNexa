"use client";

import Link from "next/link";

export default function AdminHome() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-zinc-700">
        These pages call backend <b>/api/v1/admin/**</b> endpoints and render
        the list. They are intentionally <b>read-only</b> for demo safety.
      </div>

      <ul className="mt-4 list-disc pl-5 text-sm">
        <li>
          <Link className="underline" href="/admin/territories">
            /admin/territories
          </Link>
        </li>
        <li>
          <Link className="underline" href="/admin/routes">
            /admin/routes
          </Link>
        </li>
        <li>
          <Link className="underline" href="/admin/doctors">
            /admin/doctors
          </Link>
        </li>
        <li>
          <Link className="underline" href="/admin/chemists">
            /admin/chemists
          </Link>
        </li>
        <li>
          <Link className="underline" href="/admin/products">
            /admin/products
          </Link>
        </li>
      </ul>
    </div>
  );
}
