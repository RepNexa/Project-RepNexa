"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { HoProductsPage } from "./HoProductsPage";
import {
  downloadReportBlob,
  useRegisterHoExporter,
  type HoExportFormat,
} from "@/src/features/shared/exports/hoExport";
import {
  HO_REPORT_ENDPOINTS,
  buildProductDetailsExportPayload,
  buildReportFilename,
} from "@/src/features/shared/exports/hoDrilldownExportPayloads";

export default function HoProductsPageWithExport() {
  const sp = useSearchParams();
  const spKey = sp.toString();

  const payload = useMemo(
    () => buildProductDetailsExportPayload(sp),
    [spKey, sp],
  );

  const onExport = useCallback(
    async (format: HoExportFormat) => {
      await downloadReportBlob({
        url: `${HO_REPORT_ENDPOINTS.productDetails}.${format}`,
        body: payload,
        fallbackFilename: buildReportFilename(
          "product-details",
          format,
          payload,
        ),
      });
    },
    [payload],
  );

  const exporter = useMemo(
    () => ({
      key: "ho-products",
      label: "Products",
      onExport,
    }),
    [onExport],
  );

  useRegisterHoExporter(exporter);

  return <HoProductsPage />;
}
