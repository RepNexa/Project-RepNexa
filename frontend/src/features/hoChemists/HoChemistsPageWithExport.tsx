"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { HoChemistsPage } from "./HoChemistsPage";
import {
  downloadReportBlob,
  useRegisterHoExporter,
  type HoExportFormat,
} from "@/src/features/shared/exports/hoExport";
import {
  HO_REPORT_ENDPOINTS,
  buildChemistDetailsExportPayload,
  buildReportFilename,
} from "@/src/features/shared/exports/hoDrilldownExportPayloads";

export default function HoChemistsPageWithExport() {
  const sp = useSearchParams();
  const spKey = sp.toString();

  const payload = useMemo(
    () => buildChemistDetailsExportPayload(sp),
    [spKey, sp],
  );

  const onExport = useCallback(
    async (format: HoExportFormat) => {
      await downloadReportBlob({
        url: `${HO_REPORT_ENDPOINTS.chemistDetails}.${format}`,
        body: payload,
        fallbackFilename: buildReportFilename(
          "chemist-details",
          format,
          payload,
        ),
      });
    },
    [payload],
  );

  const exporter = useMemo(
    () => ({
      key: "ho-chemists",
      label: "Chemists",
      onExport,
    }),
    [onExport],
  );

  useRegisterHoExporter(exporter);

  return <HoChemistsPage />;
}
