package com.repnexa.modules.reports.common;

import static com.repnexa.modules.reports.common.DashboardPdfModels.*;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;

public final class DashboardPdfRenderer {

    private DashboardPdfRenderer() {}

    private static final Color PRIMARY = new Color(0x7C, 0x3A, 0xED);
    private static final Color PRIMARY_DARK = new Color(0x6D, 0x28, 0xD9);
    private static final Color PRIMARY_SOFT = new Color(0xF5, 0xF3, 0xFF);
    private static final Color BORDER = new Color(0xE5, 0xE7, 0xEB);
    private static final Color TEXT = new Color(0x1F, 0x29, 0x37);
    private static final Color MUTED = new Color(0x6B, 0x72, 0x80);
    private static final Color BG = Color.WHITE;
    private static final Color ROW_ALT = new Color(0xFA, 0xFA, 0xFA);

    private static final float PAGE_MARGIN = 36f;
    private static final float PAGE_WIDTH = PDRectangle.A4.getWidth();
    private static final float PAGE_HEIGHT = PDRectangle.A4.getHeight();
    private static final float CONTENT_WIDTH = PAGE_WIDTH - (PAGE_MARGIN * 2f);

    private static final float PAGE_BOTTOM_SAFE = 34f;
    private static final float HEADER_HEIGHT = 64f;
    private static final float HERO_CARD_HEIGHT = 60f;
    private static final float HERO_GAP = 12f;
    private static final float SECTION_GAP = 14f;
    private static final float TABLE_ROW_H = 20f;

    public static byte[] render(DashboardPdfDocument docModel) {
        try (PDDocument doc = new PDDocument();
            ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            RenderState state = newPage(doc);

            drawHeader(state, docModel.title(), docModel.subtitle());
            drawMeta(state, docModel.meta());
            drawHeroKpis(state, docModel.heroKpis());

            if (docModel.sections() != null) {
                for (SectionBlock section : docModel.sections()) {
                    state = ensureSpace(doc, state, estimateSectionHeight(section));
                    drawSectionCard(state, section);
                }
            }

            if (state != null && state.cs != null) {
                state.cs.close();
            }

            stampFooters(doc, docModel.footerNote());
            doc.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to render dashboard PDF", e);
        }
    }

    private static RenderState newPage(PDDocument doc) throws IOException {
        PDPage page = new PDPage(PDRectangle.A4);
        doc.addPage(page);
        PDPageContentStream cs = new PDPageContentStream(doc, page);
        return new RenderState(doc, page, cs, PAGE_HEIGHT - PAGE_MARGIN);
    }

    private static RenderState ensureSpace(PDDocument doc, RenderState state, float requiredHeight) throws IOException {
        if (state.y - requiredHeight >= PAGE_MARGIN + PAGE_BOTTOM_SAFE) {
            return state;
        }
        state.cs.close();
        return newPage(doc);
    }

    private static void drawHeader(RenderState s, String title, String subtitle) throws IOException {
        float top = s.y;

        fillRect(s.cs, PAGE_MARGIN, top - HEADER_HEIGHT, CONTENT_WIDTH, HEADER_HEIGHT, BG);
        fillRect(s.cs, PAGE_MARGIN, top - HEADER_HEIGHT, 8f, HEADER_HEIGHT, PRIMARY);
        strokeRect(s.cs, PAGE_MARGIN, top - HEADER_HEIGHT, CONTENT_WIDTH, HEADER_HEIGHT, BORDER);

        drawText(s.cs, safe(title), PAGE_MARGIN + 20f, top - 24f, PDType1Font.HELVETICA_BOLD, 18f, TEXT);
        drawText(s.cs, safe(subtitle), PAGE_MARGIN + 20f, top - 44f, PDType1Font.HELVETICA, 10f, MUTED);

        s.y = top - HEADER_HEIGHT - 16f;
    }

    private static void drawMeta(RenderState s, List<MetaItem> meta) throws IOException {
        if (meta == null || meta.isEmpty()) return;

        float x = PAGE_MARGIN;
        float y = s.y;
        float rowH = 18f;
        float col1 = 130f;

        for (MetaItem item : meta) {
            drawText(s.cs, safe(item.label()), x, y, PDType1Font.HELVETICA_BOLD, 9f, MUTED);
            drawText(s.cs, safe(item.value()), x + col1, y, PDType1Font.HELVETICA, 9f, TEXT);
            y -= rowH;
        }
        s.y = y - 8f;
    }

    private static void drawHeroKpis(RenderState s, List<KpiItem> kpis) throws IOException {
        if (kpis == null || kpis.isEmpty()) return;

        int cols = Math.min(4, Math.max(1, kpis.size()));
        float cardW = (CONTENT_WIDTH - (HERO_GAP * (cols - 1))) / cols;
        float cardH = HERO_CARD_HEIGHT;

        float yTop = s.y;

        for (int i = 0; i < kpis.size(); i++) {
            KpiItem k = kpis.get(i);
            int col = i % cols;
            int row = i / cols;

            float cx = PAGE_MARGIN + col * (cardW + HERO_GAP);
            float cy = yTop - row * (cardH + HERO_GAP);

            fillRect(s.cs, cx, cy - cardH, cardW, cardH, BG);
            fillRect(s.cs, cx, cy - cardH, 4f, cardH, PRIMARY);
            strokeRect(s.cs, cx, cy - cardH, cardW, cardH, BORDER);

            drawText(s.cs, safe(k.label()), cx + 12f, cy - 18f, PDType1Font.HELVETICA, 9f, MUTED);
            drawText(s.cs, safe(k.value()), cx + 12f, cy - 40f, PDType1Font.HELVETICA_BOLD, 16f, TEXT);
        }

        int rows = (int) Math.ceil(kpis.size() / (double) cols);
        s.y = yTop - rows * (cardH + HERO_GAP) + HERO_GAP - 12f;
    }

    private static void drawSectionCard(RenderState s, SectionBlock section) throws IOException {
        float sectionTop = s.y;
        float height = estimateSectionHeight(section);

        fillRect(s.cs, PAGE_MARGIN, sectionTop - height, CONTENT_WIDTH, height, BG);
        strokeRect(s.cs, PAGE_MARGIN, sectionTop - height, CONTENT_WIDTH, height, BORDER);
        fillRect(s.cs, PAGE_MARGIN, sectionTop - 28f, CONTENT_WIDTH, 28f, PRIMARY_SOFT);

        drawText(s.cs, safe(section.title()), PAGE_MARGIN + 12f, sectionTop - 18f, PDType1Font.HELVETICA_BOLD, 11f, PRIMARY_DARK);

        float cursorY = sectionTop - 46f;

        if (section.kpis() != null && !section.kpis().isEmpty()) {
            float gap = 10f;
            int cols = Math.min(3, Math.max(1, section.kpis().size()));
            float boxW = (CONTENT_WIDTH - 24f - (gap * (cols - 1))) / cols;
            float boxH = 50f;

            for (int i = 0; i < section.kpis().size(); i++) {
                KpiItem k = section.kpis().get(i);
                int col = i % cols;
                int row = i / cols;

                float bx = PAGE_MARGIN + 12f + col * (boxW + gap);
                float by = cursorY - row * (boxH + gap);

                fillRect(s.cs, bx, by - boxH, boxW, boxH, new Color(0xFC, 0xFC, 0xFD));
                strokeRect(s.cs, bx, by - boxH, boxW, boxH, BORDER);

                drawText(s.cs, safe(k.label()), bx + 10f, by - 16f, PDType1Font.HELVETICA, 8.5f, MUTED);
                drawText(s.cs, safe(k.value()), bx + 10f, by - 34f, PDType1Font.HELVETICA_BOLD, 13f, TEXT);
            }

            int rows = (int) Math.ceil(section.kpis().size() / (double) cols);
            cursorY -= rows * (boxH + gap) - gap + 12f;
        }

        if (section.tables() != null) {
            for (TableBlock table : section.tables()) {
                cursorY = drawTableInsideCard(s, table, cursorY);
                cursorY -= 10f;
            }
        }

        if (section.texts() != null) {
            for (TextBlock text : section.texts()) {
                cursorY = drawTextBlockInsideCard(s, text, cursorY);
                cursorY -= 8f;
            }
        }

        s.y = sectionTop - height - SECTION_GAP;
    }

    private static float drawTableInsideCard(RenderState s, TableBlock table, float startY) throws IOException {
        float x = PAGE_MARGIN + 12f;
        float y = startY;

        if (table.title() != null && !table.title().isBlank()) {
            drawText(s.cs, safe(table.title()), x, y, PDType1Font.HELVETICA_BOLD, 10f, TEXT);
            y -= 16f;
        }

        List<String> headers = table.headers() == null ? List.of() : table.headers();
        List<List<String>> rows = table.rows() == null ? List.of() : table.rows();

        int colCount = Math.max(1, headers.size());
        float tableW = CONTENT_WIDTH - 24f;
        float colW = tableW / colCount;
        int cellMaxChars = Math.max(8, (int) (colW / 4.6f));

        if (!headers.isEmpty()) {
            fillRect(s.cs, x, y - TABLE_ROW_H + 4f, tableW, TABLE_ROW_H, PRIMARY_SOFT);
            strokeRect(s.cs, x, y - TABLE_ROW_H + 4f, tableW, TABLE_ROW_H, BORDER);

            for (int i = 0; i < headers.size(); i++) {
                drawText(
                        s.cs,
                        truncate(headers.get(i), cellMaxChars),
                        x + i * colW + 5f,
                        y - 11f,
                        PDType1Font.HELVETICA_BOLD,
                        8f,
                        PRIMARY_DARK
                );
            }
            y -= TABLE_ROW_H;
        }

        for (int r = 0; r < rows.size(); r++) {
            if (r % 2 == 1) {
                fillRect(s.cs, x, y - TABLE_ROW_H + 4f, tableW, TABLE_ROW_H, ROW_ALT);
            }
            strokeRect(s.cs, x, y - TABLE_ROW_H + 4f, tableW, TABLE_ROW_H, BORDER);

            List<String> row = rows.get(r);
            for (int c = 0; c < colCount; c++) {
                String value = c < row.size() ? row.get(c) : "";
                drawText(
                        s.cs,
                        truncate(value, cellMaxChars),
                        x + c * colW + 5f,
                        y - 11f,
                        PDType1Font.HELVETICA,
                        8f,
                        TEXT
                );
            }
            y -= TABLE_ROW_H;
        }

        return y;
    }

    private static float drawTextBlockInsideCard(RenderState s, TextBlock block, float startY) throws IOException {
        float x = PAGE_MARGIN + 12f;
        float y = startY;

        if (block.title() != null && !block.title().isBlank()) {
            drawText(s.cs, safe(block.title()), x, y, PDType1Font.HELVETICA_BOLD, 10f, TEXT);
            y -= 15f;
        }

        if (block.lines() != null) {
            for (String raw : block.lines()) {
                for (String line : wrap(safe(raw), 110)) {
                    drawText(s.cs, line, x, y, PDType1Font.HELVETICA, 8.5f, TEXT);
                    y -= 12f;
                }
            }
        }
        return y;
    }

    private static float estimateSectionHeight(SectionBlock section) {
        float h = 40f;

        if (section.kpis() != null && !section.kpis().isEmpty()) {
            int cols = Math.min(3, Math.max(1, section.kpis().size()));
            int rows = (int) Math.ceil(section.kpis().size() / (double) cols);
            h += rows * 60f;
        }

        if (section.tables() != null) {
            for (TableBlock t : section.tables()) {
                int rowCount = t.rows() == null ? 0 : t.rows().size();
                h += 28f + TABLE_ROW_H + Math.max(1, rowCount) * TABLE_ROW_H;
            }
        }

        if (section.texts() != null) {
            for (TextBlock t : section.texts()) {
                int lines = t.lines() == null ? 1 : Math.max(1, t.lines().size());
                h += 24f + lines * 12f + 4f;
            }
        }

        return Math.max(90f, h + 10f);
    }

    private static void stampFooters(PDDocument doc, String footerNote) throws IOException {
        int totalPages = doc.getNumberOfPages();
        String ts = OffsetDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));

        for (int i = 0; i < totalPages; i++) {
            PDPage page = doc.getPage(i);
            try (PDPageContentStream cs = new PDPageContentStream(doc, page, AppendMode.APPEND, true, true)) {
                float y = 18f;
                drawText(cs, safe(footerNote), PAGE_MARGIN, y, PDType1Font.HELVETICA, 8f, MUTED);
                drawText(cs, "Generated " + ts, PAGE_MARGIN + 220f, y, PDType1Font.HELVETICA, 8f, MUTED);
                drawRightAlignedText(cs, "Page " + (i + 1) + " / " + totalPages, PAGE_WIDTH - PAGE_MARGIN, y, PDType1Font.HELVETICA, 8f, MUTED);
            }
        }
    }

    private static void drawText(PDPageContentStream cs, String text, float x, float y,
                                 PDType1Font font, float size, Color color) throws IOException {
        cs.beginText();
        cs.setFont(font, size);
        cs.setNonStrokingColor(color);
        cs.newLineAtOffset(x, y);
        cs.showText(safe(text));
        cs.endText();
    }

    private static void drawRightAlignedText(
            PDPageContentStream cs,
            String text,
            float rightX,
            float y,
            PDType1Font font,
            float size,
            Color color
    ) throws IOException {
        String safeText = safe(text);
        float width = font.getStringWidth(safeText) / 1000f * size;
        drawText(cs, safeText, rightX - width, y, font, size, color);
    }

    private static void fillRect(PDPageContentStream cs, float x, float y, float w, float h, Color color) throws IOException {
        cs.setNonStrokingColor(color);
        cs.addRect(x, y, w, h);
        cs.fill();
    }

    private static void strokeRect(PDPageContentStream cs, float x, float y, float w, float h, Color color) throws IOException {
        cs.setStrokingColor(color);
        cs.addRect(x, y, w, h);
        cs.stroke();
    }

    private static String safe(String s) {
        return ReportFormatters.safePdfText(s);
    }

    private static String truncate(String s, int max) {
        return ReportFormatters.truncateCell(s, max);
    }

    private static List<String> wrap(String text, int maxChars) {
        List<String> out = new ArrayList<>();
        if (text == null || text.isBlank()) {
            out.add("");
            return out;
        }
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

    private static final class RenderState {
        final PDDocument doc;
        final PDPage page;
        final PDPageContentStream cs;
        float y;

        RenderState(PDDocument doc, PDPage page, PDPageContentStream cs, float y) {
            this.doc = doc;
            this.page = page;
            this.cs = cs;
            this.y = y;
        }
    }
}