package com.repnexa.modules.reports.common;

import java.util.List;

public final class DashboardPdfModels {
    private DashboardPdfModels() {}

    public record MetaItem(String label, String value) {}

    public record KpiItem(String label, String value) {}

    public record TableBlock(
            String title,
            List<String> headers,
            List<List<String>> rows
    ) {}

    public record TextBlock(
            String title,
            List<String> lines
    ) {}

    public record SectionBlock(
            String title,
            List<KpiItem> kpis,
            List<TableBlock> tables,
            List<TextBlock> texts
    ) {}

    public record DashboardPdfDocument(
            String title,
            String subtitle,
            List<MetaItem> meta,
            List<KpiItem> heroKpis,
            List<SectionBlock> sections,
            String footerNote
    ) {}
}