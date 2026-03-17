"use client";

import * as React from "react";
import {
  downloadGetBlob,
  type HoExportFormat,
  useRegisterHoExporter,
} from "./hoExport";

type Args = {
  label: string;
  url: string;
  fallbackFilename: string;
};

export function useRegisterCsvPageExport({
  label,
  url,
  fallbackFilename,
}: Args) {
  const onExport = React.useCallback(
    async (format: HoExportFormat) => {
      if (format !== "csv") return;
      await downloadGetBlob({
        url,
        fallbackFilename,
      });
    },
    [url, fallbackFilename],
  );

  const exporter = React.useMemo(
    () => ({
      label,
      formats: ["csv"] as HoExportFormat[],
      onExport,
    }),
    [label, onExport],
  );

  useRegisterHoExporter(exporter);
}
