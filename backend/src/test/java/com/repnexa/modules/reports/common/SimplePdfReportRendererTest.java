package com.repnexa.modules.reports.common;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SimplePdfReportRendererTest {

    @Test
    void render_returns_non_empty_pdf_with_pdf_magic_header() throws Exception {
        byte[] bytes = SimplePdfReportRenderer.render("Weekly Report", List.of("Line 1", "Line 2"));

        assertNotNull(bytes);
        assertTrue(bytes.length > 100);
        assertEquals("%PDF", new String(bytes, 0, 4, StandardCharsets.ISO_8859_1));

        try (PDDocument doc = PDDocument.load(bytes)) {
            assertEquals(1, doc.getNumberOfPages());
        }
    }

    @Test
    void render_accepts_null_lines_and_problematic_characters() throws Exception {
        byte[] bytes = assertDoesNotThrow(() ->
                SimplePdfReportRenderer.render(
                        "Δ Report",
                        Arrays.asList((String) null, "A—B", "Quoted “text”")
                )
        );

        assertNotNull(bytes);
        assertTrue(bytes.length > 100);

        try (PDDocument doc = PDDocument.load(bytes)) {
            assertTrue(doc.getNumberOfPages() >= 1);
        }
    }
}
