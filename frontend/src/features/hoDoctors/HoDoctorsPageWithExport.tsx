"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { HoDoctorsPage } from "./HoDoctorsPage";
import {
  downloadReportBlob,
  useRegisterHoExporter,
  type HoExportFormat,
} from "@/src/features/shared/exports/hoExport";
import {
  HO_REPORT_ENDPOINTS,
  buildDoctorDetailsExportPayload,
  buildReportFilename,
} from "@/src/features/shared/exports/hoDrilldownExportPayloads";

export default function HoDoctorsPageWithExport() {
  const sp = useSearchParams();
  const spKey = sp.toString();

  const payload = useMemo(
    () => buildDoctorDetailsExportPayload(sp),
    [spKey, sp],
  );

  const onExport = useCallback(
    async (format: HoExportFormat) => {
      await downloadReportBlob({
        url: `${HO_REPORT_ENDPOINTS.doctorDetails}.${format}`,
        body: payload,
        fallbackFilename: buildReportFilename(
          "doctor-details",
          format,
          payload,
        ),
      });
    },
    [payload],
  );

  const exporter = useMemo(
    () => ({
      key: "ho-doctors",
      label: "Doctors",
      onExport,
    }),
    [onExport],
  );

  useRegisterHoExporter(exporter);

  return <HoDoctorsPage />;
}
