"use client";

import Page from "@/src/features/adminMaster/pages/legacy/AdminRoutes";
import { useRegisterCsvPageExport } from "@/src/features/shared/exports/useCsvPageExport";

export default function AdminRoutesPage() {
  useRegisterCsvPageExport({
    label: "Admin – Routes",
    url: "/api/v1/admin/routes.csv",
    fallbackFilename: "admin-routes.csv",
  });

  return <Page />;
}
