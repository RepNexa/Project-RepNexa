import { redirect } from "next/navigation";

type Props = {
  params: { doctorId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Page({ params, searchParams }: Props) {
  const id = Number(params.doctorId);
  if (!Number.isFinite(id) || id <= 0) redirect("/ho/doctors");

  const qs = new URLSearchParams();

  // carry over any existing query params (period/dateFrom/dateTo/page/size/etc.)
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
      else qs.set(k, v);
    }
  }

  // force doctorId from the path param
  qs.set("doctorId", String(id));

  redirect(`/ho/doctors?${qs.toString()}`);
}
