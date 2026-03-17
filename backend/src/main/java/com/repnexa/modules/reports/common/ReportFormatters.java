package com.repnexa.modules.reports.common;

import java.text.DecimalFormat;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

public final class ReportFormatters {
    private ReportFormatters() {}

    public static String fmtDate(LocalDate d) {
        return d == null ? "N/A" : d.toString();
    }

    public static String fmtNum(Number n) {
        return n == null ? "N/A" : String.valueOf(n);
    }

    public static String fmtDecimal(Double d) {
        if (d == null) return "N/A";
        return new DecimalFormat("0.00").format(d);
    }

    public static String fmtPct(Double ratio) {
        if (ratio == null) return "N/A";
        return new DecimalFormat("0.00").format(ratio * 100.0) + "%";
    }

    public static String safe(String s) {
        return s == null ? "" : s;
    }

    public static String joinLongs(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return "(none)";
        return ids.stream().map(String::valueOf).collect(Collectors.joining(", "));
    }

    public static String safePdfText(String s) {
        if (s == null) return "";
        return s
                .replace('\u00A0', ' ')
                .replace("Δ", "Delta")
                .replace("•", "-")
                .replace("–", "-")
                .replace("—", "-")
                .replace("“", "\"")
                .replace("”", "\"")
                .replace("‘", "'")
                .replace("’", "'")
                .replace("…", "...")
                .replace('\t', ' ')
                .replace('\u0000', ' ')
                .replace('\u0001', ' ')
                .replace('\u0002', ' ')
                .replace('\u0003', ' ')
                .replace('\u0004', ' ')
                .replace('\u0005', ' ')
                .replace('\u0006', ' ')
                .replace('\u0007', ' ')
                .replace('\b', ' ')
                .replace('\f', ' ');
    }

    public static String truncateCell(String s, int max) {
        String v = safePdfText(s);
        if (max <= 3) return v;
        if (v.length() <= max) return v;
        return v.substring(0, Math.max(0, max - 3)) + "...";
    }
}