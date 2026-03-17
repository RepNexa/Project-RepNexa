package com.repnexa.modules.reports.common;

import java.nio.charset.StandardCharsets;

public final class CsvWriter {
    private final StringBuilder sb = new StringBuilder();
    private boolean wroteAnyRow = false;

    public CsvWriter withUtf8Bom() {
        // Excel-friendly UTF-8 BOM
        if (sb.length() == 0) {
            sb.append('\uFEFF');
        }
        return this;
    }

    public CsvWriter row(Object... cells) {
        if (wroteAnyRow) {
            sb.append("\r\n");
        }
        wroteAnyRow = true;

        if (cells == null || cells.length == 0) {
            return this; // blank row
        }

        for (int i = 0; i < cells.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(escape(cells[i]));
        }
        return this;
    }

    public byte[] toBytes() {
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static String escape(Object value) {
        if (value == null) return "";
        String s = String.valueOf(value);

        boolean mustQuote =
                s.contains(",") ||
                s.contains("\"") ||
                s.contains("\r") ||
                s.contains("\n");

        if (!mustQuote) return s;

        return "\"" + s.replace("\"", "\"\"") + "\"";
    }
}