import AppShell from "./_components/AppShell";

export default function Home() {
  return (
    <AppShell title="RepNexa Demo Console">
      <div className="rounded border bg-white p-4">
        <div className="text-sm text-zinc-700">
          Use the navigation bar to access:
        </div>
        <ul className="mt-3 list-disc pl-5 text-sm">
          <li>
            <b>/login</b> – sign in (CM / FM / MR)
          </li>
          <li>
            <b>/admin</b> – CM admin screens (read-only lists)
          </li>
          <li>
            <b>/rep</b> – MR portal + submissions (DCR / Mileage / Chemist)
          </li>
        </ul>

        <div className="mt-4 text-sm text-zinc-700">
          If MR shows <b>No active assignments</b>, run the seed script in
          section (4) to create a rep-route assignment.
        </div>
      </div>
    </AppShell>
  );
}
