package com.repnexa.modules.reports.common;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;

public final class SimplePdfReportRenderer {

    private SimplePdfReportRenderer() {}

    public static byte[] render(String title, List<String> lines) {
        try (PDDocument doc = new PDDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            final float margin = 42f;
            final float fontSize = 10f;
            final float leading = 14f;
            final int wrapChars = 115;

            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            PageCursor cursor = beginPage(doc, page, margin, fontSize);

            // Title (slightly larger)
            cursor.stream.setFont(PDType1Font.HELVETICA_BOLD, 13f);
            cursor.stream.showText(safe(title));
            cursor.stream.newLineAtOffset(0, -18f);
            cursor.y -= 18f;

            cursor.stream.setFont(PDType1Font.HELVETICA, fontSize);

            if (lines != null) {
                for (String raw : lines) {
                    List<String> wrapped = wrap(raw == null ? "" : raw, wrapChars);
                    if (wrapped.isEmpty()) wrapped = List.of("");

                    for (String line : wrapped) {
                        if (cursor.y <= margin + leading) {
                            endPage(cursor);
                            page = new PDPage(PDRectangle.A4);
                            doc.addPage(page);
                            cursor = beginPage(doc, page, margin, fontSize);
                        }
                        cursor.stream.showText(safe(line));
                        cursor.stream.newLineAtOffset(0, -leading);
                        cursor.y -= leading;
                    }
                }
            }

            endPage(cursor);
            doc.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to render PDF report", e);
        }
    }

    private static PageCursor beginPage(PDDocument doc, PDPage page, float margin, float fontSize) throws IOException {
        PDPageContentStream stream = new PDPageContentStream(doc, page);
        float pageHeight = page.getMediaBox().getHeight();
        float yStart = pageHeight - margin;

        stream.beginText();
        stream.setFont(PDType1Font.HELVETICA, fontSize);
        stream.newLineAtOffset(margin, yStart);

        return new PageCursor(stream, yStart);
    }

    private static void endPage(PageCursor cursor) throws IOException {
        cursor.stream.endText();
        cursor.stream.close();
    }

    private static String safe(String s) {
        return ReportFormatters.safePdfText(s);
    }

    private static List<String> wrap(String text, int maxChars) {
        List<String> out = new ArrayList<>();
        if (text == null) {
            out.add("");
            return out;
        }
        text = safe(text);
        if (text.length() <= maxChars) {
            out.add(text);
            return out;
        }

        String remaining = text;
        while (remaining.length() > maxChars) {
            int cut = remaining.lastIndexOf(' ', maxChars);
            if (cut <= 0) cut = maxChars;
            out.add(remaining.substring(0, cut).trim());
            remaining = remaining.substring(cut).trim();
        }
        if (!remaining.isEmpty()) out.add(remaining);
        return out;
    }

    private static final class PageCursor {
        final PDPageContentStream stream;
        float y;

        PageCursor(PDPageContentStream stream, float y) {
            this.stream = stream;
            this.y = y;
        }
    }
}