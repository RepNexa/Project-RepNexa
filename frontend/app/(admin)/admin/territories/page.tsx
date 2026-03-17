"use client";

import Page from "@/src/features/adminGeo/pages/legacy/AdminTerritories";
import { useRegisterCsvPageExport } from "@/src/features/shared/exports/useCsvPageExport";

export default function AdminTerritoriesPage() {
  useRegisterCsvPageExport({
    label: "Admin – Territories",
    url: "/api/v1/admin/territories.csv",
    fallbackFilename: "admin-territories.csv",
  });

  return <Page />;
}
