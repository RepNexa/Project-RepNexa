package com.repnexa.modules.reports.common;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ReportFormattersTest {

    @Test
    void fmtPct_formats_ratio_to_two_decimal_percentage() {
        assertEquals("12.50%", ReportFormatters.fmtPct(0.125));
        assertEquals("N/A", ReportFormatters.fmtPct(null));
    }

    @Test
    void safePdfText_normalizes_problematic_characters() {
        String input = "Δ • – — “x” ‘y’ …\t";
        String normalized = ReportFormatters.safePdfText(input);

        assertEquals("Delta - - - \"x\" 'y' ... ", normalized);
    }

    @Test
    void truncateCell_uses_safe_pdf_text_and_appends_ellipsis() {
        String value = "A—B—C—D";
        assertEquals("A-B...", ReportFormatters.truncateCell(value, 6));
    }

    @Test
    void joinLongs_handles_empty_and_non_empty_lists() {
        assertEquals("(none)", ReportFormatters.joinLongs(java.util.List.of()));
        assertEquals("1, 2, 3", ReportFormatters.joinLongs(java.util.List.of(1L, 2L, 3L)));
    }
}
