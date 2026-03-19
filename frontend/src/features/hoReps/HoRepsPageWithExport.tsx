"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { HoRepsPage } from "./HoRepsPage";
import {
  downloadReportBlob,
  useRegisterHoExporter,
  type HoExportFormat,
} from "@/src/features/shared/exports/hoExport";
import {
  HO_REPORT_ENDPOINTS,
  buildRepDetailsExportPayload,
  buildReportFilename,
} from "@/src/features/shared/exports/hoDrilldownExportPayloads";

export default function HoRepsPageWithExport() {
  const sp = useSearchParams();
  const spKey = sp.toString();

  const payload = useMemo(() => buildRepDetailsExportPayload(sp), [spKey, sp]);

  const onExport = useCallback(
    async (format: HoExportFormat) => {
      await downloadReportBlob({
        url: `${HO_REPORT_ENDPOINTS.repDetails}.${format}`,
        body: payload,
        fallbackFilename: buildReportFilename("rep-details", format, payload),
      });
    },
    [payload],
  );

  const exporter = useMemo(
    () => ({
      key: "ho-reps",
      label: "Reps",
      onExport,
    }),
    [onExport],
  );

  useRegisterHoExporter(exporter);

  return <HoRepsPage />;
}
