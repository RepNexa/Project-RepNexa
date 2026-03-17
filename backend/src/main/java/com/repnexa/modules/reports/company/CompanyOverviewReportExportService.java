package com.repnexa.modules.reports.company;

import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.CompanyOverviewRequest;
import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.CompanyOverviewResponse;
import com.repnexa.modules.analytics.company.service.CompanyOverviewService;
import com.repnexa.modules.reports.common.CsvWriter;
import com.repnexa.modules.reports.common.SimplePdfReportRenderer;
import java.text.DecimalFormat;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import static com.repnexa.modules.reports.common.DashboardPdfModels.*;
import com.repnexa.modules.reports.common.DashboardPdfRenderer;
import com.repnexa.modules.reports.common.ReportFormatters;

@Service
public class CompanyOverviewReportExportService {

    private final CompanyOverviewService companyOverviewService;

    public CompanyOverviewReportExportService(CompanyOverviewService companyOverviewService) {
        this.companyOverviewService = companyOverviewService;
    }

    public record ReportBinary(byte[] bytes, String filename) {}

    public ReportBinary exportCsv(CompanyOverviewRequest req, Authentication auth) {
        CompanyOverviewResponse resp = companyOverviewService.compute(req, auth);
        byte[] bytes = buildCsv(resp);
        return new ReportBinary(bytes, buildFilename("company-overview", resp, "csv"));
    }

    public ReportBinary exportPdf(CompanyOverviewRequest req, Authentication auth) {
        CompanyOverviewResponse resp = companyOverviewService.compute(req, auth);
        byte[] bytes = buildPdf(resp);
        return new ReportBinary(bytes, buildFilename("company-overview", resp, "pdf"));
    }

    private byte[] buildCsv(CompanyOverviewResponse r) {
        CsvWriter csv = new CsvWriter().withUtf8Bom();

        // Meta
        csv.row("Section", "Field", "Value");
        csv.row("Meta", "Date From", fmtDate(r.periodUsed().dateFrom()));
        csv.row("Meta", "Date To", fmtDate(r.periodUsed().dateTo()));
        csv.row("Meta", "Effective Route IDs", joinLongs(r.scope().effectiveRouteIds()));
        csv.row();

        // Summary KPI section
        csv.row("Summary KPIs");
        csv.row("Metric", "Value");
        csv.row("Coverage % (selected grade)", fmtPct(r.coverageSelectedGrade().value()));
        csv.row("Coverage Δ vs Last Month", fmtPct(r.coverageSelectedGrade().deltaVsLastMonth()));
        csv.row("Doctors At Risk", fmtNum(r.doctorsAtRisk()));
        csv.row("Visits", fmtNum(r.visits()));
        csv.row("Avg Doctor Visits", fmtDecimal(r.avgDoctorVisits()));
        csv.row();

        // Coverage by grade
        csv.row("Coverage By Grade");
        csv.row("Grade", "Coverage %");
        for (var x : r.coverageByGrade()) {
            csv.row(x.grade(), fmtPct(x.value()));
        }
        csv.row();

        // Target achievement by rep
        csv.row("Target Achievement By Rep");
        csv.row("Rep User ID", "Rep Username", "Achievement %");
        for (var x : r.targetAchievementByRep()) {
            csv.row(x.repUserId(), x.repUsername(), fmtPct(x.achievement()));
        }
        csv.row();

        // Rep performance (simple)
        csv.row("Rep Performance Table");
        csv.row("Rep User ID", "Rep Username", "Visits");
        for (var x : r.repPerformanceTable()) {
            csv.row(x.repUserId(), x.repUsername(), fmtNum(x.visits()));
        }
        csv.row();

        // Product coverage matrix
        csv.row("Product Coverage Matrix");
        csv.row("Code", "Name", "Coverage %");
        for (var x : r.productCoverageMatrix()) {
            csv.row(x.code(), x.name(), fmtPct(x.coverage()));
        }
        csv.row();

        // OOS sections
        csv.row("OOS By Product");
        csv.row("Key", "Count");
        for (var x : r.oosByProduct()) {
            csv.row(x.key(), fmtNum(x.count()));
        }
        csv.row();

        csv.row("OOS By Route");
        csv.row("Key", "Count");
        for (var x : r.oosByRoute()) {
            csv.row(x.key(), fmtNum(x.count()));
        }
        csv.row();

        csv.row("OOS By Territory");
        csv.row("Key", "Count");
        for (var x : r.oosByTerritory()) {
            csv.row(x.key(), fmtNum(x.count()));
        }
        csv.row();

        // Detailed rep performance
        csv.row("Rep Performance Detail");
        csv.row(
                "Rep User ID",
                "Rep Username",
                "Territory",
                "Total Visits",
                "Unique Doctors",
                "A Grade Visits",
                "B Grade Visits",
                "C Grade Visits"
        );
        for (var x : r.repPerformanceDetail()) {
            csv.row(
                    x.repUserId(),
                    x.repUsername(),
                    x.territory(),
                    x.totalVisits(),
                    x.uniqueDoctors(),
                    x.aGradeVisits(),
                    x.bGradeVisits(),
                    x.cGradeVisits()
            );
        }
        csv.row();

        // Product coverage by grade
        csv.row("Product Coverage By Grade");
        csv.row("Code", "Name", "All Doctors", "A Doctors", "B Doctors", "C Doctors");
        for (var x : r.productCoverageByGrade()) {
            csv.row(
                    x.code(),
                    x.name(),
                    x.allDoctors(),
                    x.aDoctors(),
                    x.bDoctors(),
                    x.cDoctors()
            );
        }
        csv.row();

        // Flags
        csv.row("Flags");
        csv.row("Flag", "Value");
        csv.row("noData", r.flags().noData());
        csv.row("gradeNotSupported", r.flags().gradeNotSupported());
        csv.row("targetAchievementNa", r.flags().targetAchievementNa());
        csv.row("repPerformanceNa", r.flags().repPerformanceNa());
        csv.row("productCoverageMatrixNa", r.flags().productCoverageMatrixNa());
        csv.row("oosNa", r.flags().oosNa());

        return csv.toBytes();
    }

    private byte[] buildPdf(CompanyOverviewResponse r) {
        List<MetaItem> meta = List.of(
                new MetaItem("Date From", ReportFormatters.fmtDate(r.periodUsed().dateFrom())),
                new MetaItem("Date To", ReportFormatters.fmtDate(r.periodUsed().dateTo())),
                new MetaItem("Effective Route IDs", ReportFormatters.joinLongs(r.scope().effectiveRouteIds()))
        );

        List<KpiItem> heroKpis = List.of(
                new KpiItem("Coverage %", ReportFormatters.fmtPct(r.coverageSelectedGrade().value())),
                new KpiItem("Doctors At Risk", ReportFormatters.fmtNum(r.doctorsAtRisk())),
                new KpiItem("Visits", ReportFormatters.fmtNum(r.visits())),
                new KpiItem("Avg Doctor Visits", ReportFormatters.fmtDecimal(r.avgDoctorVisits()))
        );

        List<SectionBlock> sections = new ArrayList<>();

        sections.add(new SectionBlock(
                "Coverage & Achievement",
                List.of(
                        new KpiItem("Coverage Delta vs Last Month", ReportFormatters.fmtPct(r.coverageSelectedGrade().deltaVsLastMonth()))
                ),
                List.of(
                        new TableBlock(
                                "Coverage By Grade",
                                List.of("Grade", "Coverage %"),
                                r.coverageByGrade().stream()
                                        .map(x -> List.of(
                                                ReportFormatters.safe(x.grade()),
                                                ReportFormatters.fmtPct(x.value())
                                        ))
                                        .toList()
                        ),
                        new TableBlock(
                                "Target Achievement By Rep",
                                List.of("Rep User ID", "Rep Username", "Achievement %"),
                                r.targetAchievementByRep().stream()
                                        .map(x -> List.of(
                                                String.valueOf(x.repUserId()),
                                                ReportFormatters.safe(x.repUsername()),
                                                ReportFormatters.fmtPct(x.achievement())
                                        ))
                                        .toList()
                        )
                ),
                List.of()
        ));

        sections.add(new SectionBlock(
                "Rep Performance",
                List.of(),
                List.of(
                        new TableBlock(
                                "Rep Performance Table",
                                List.of("Rep User ID", "Rep Username", "Visits"),
                                r.repPerformanceTable().stream()
                                        .map(x -> List.of(
                                                x.repUserId() == null ? "N/A" : String.valueOf(x.repUserId()),
                                                ReportFormatters.safe(x.repUsername()),
                                                ReportFormatters.fmtNum(x.visits())
                                        ))
                                        .toList()
                        ),
                        new TableBlock(
                                "Rep Performance Detail",
                                List.of("Rep", "Territory", "Total", "Unique", "A", "B", "C"),
                                r.repPerformanceDetail().stream()
                                        .map(x -> List.of(
                                                ReportFormatters.safe(x.repUsername()),
                                                ReportFormatters.safe(x.territory()),
                                                String.valueOf(x.totalVisits()),
                                                String.valueOf(x.uniqueDoctors()),
                                                String.valueOf(x.aGradeVisits()),
                                                String.valueOf(x.bGradeVisits()),
                                                String.valueOf(x.cGradeVisits())
                                        ))
                                        .toList()
                        )
                ),
                List.of()
        ));

        sections.add(new SectionBlock(
                "Products & OOS",
                List.of(),
                List.of(
                        new TableBlock(
                                "Product Coverage Matrix",
                                List.of("Code", "Name", "Coverage %"),
                                r.productCoverageMatrix().stream()
                                        .map(x -> List.of(
                                                ReportFormatters.safe(x.code()),
                                                ReportFormatters.safe(x.name()),
                                                ReportFormatters.fmtPct(x.coverage())
                                        ))
                                        .toList()
                        ),
                        new TableBlock(
                                "OOS By Product",
                                List.of("Key", "Count"),
                                r.oosByProduct().stream()
                                        .map(x -> List.of(
                                                ReportFormatters.safe(x.key()),
                                                ReportFormatters.fmtNum(x.count())
                                        ))
                                        .toList()
                        ),
                        new TableBlock(
                                "OOS By Route",
                                List.of("Key", "Count"),
                                r.oosByRoute().stream()
                                        .map(x -> List.of(
                                                ReportFormatters.safe(x.key()),
                                                ReportFormatters.fmtNum(x.count())
                                        ))
                                        .toList()
                        ),
                        new TableBlock(
                                "OOS By Territory",
                                List.of("Key", "Count"),
                                r.oosByTerritory().stream()
                                        .map(x -> List.of(
                                                ReportFormatters.safe(x.key()),
                                                ReportFormatters.fmtNum(x.count())
                                        ))
                                        .toList()
                        )
                ),
                List.of(
                        new TextBlock(
                                "Flags",
                                List.of(
                                        "noData = " + r.flags().noData(),
                                        "gradeNotSupported = " + r.flags().gradeNotSupported(),
                                        "targetAchievementNa = " + r.flags().targetAchievementNa(),
                                        "repPerformanceNa = " + r.flags().repPerformanceNa(),
                                        "productCoverageMatrixNa = " + r.flags().productCoverageMatrixNa(),
                                        "oosNa = " + r.flags().oosNa()
                                )
                        )
                )
        ));

        DashboardPdfDocument doc = new DashboardPdfDocument(
                "RepNexa Company Overview",
                "Head Office analytics report",
                meta,
                heroKpis,
                sections,
                "RepNexa | CM export"
        );

        return DashboardPdfRenderer.render(doc);
    }

    private static void appendPoints(List<String> lines, List<?> points) {
        if (points == null || points.isEmpty()) {
            lines.add(" (none)");
            return;
        }
        for (Object p : points) {
            // We know the records have key()/count(), but keep this generic/simple here.
            lines.add(" - " + String.valueOf(p));
        }
    }

    private String buildFilename(String prefix, CompanyOverviewResponse r, String ext) {
        String from = fmtDate(r.periodUsed().dateFrom());
        String to = fmtDate(r.periodUsed().dateTo());
        return prefix + "_" + from + "_to_" + to + "." + ext;
    }

    private static String fmtDate(LocalDate d) {
        return d == null ? "N/A" : d.toString();
    }

    private static String fmtNum(Number n) {
        return n == null ? "N/A" : String.valueOf(n);
    }

    private static String fmtDecimal(Double d) {
        if (d == null) return "N/A";
        return new DecimalFormat("0.00").format(d);
    }

    private static String fmtPct(Double ratio) {
        if (ratio == null) return "N/A";
        return new DecimalFormat("0.00").format(ratio * 100.0) + "%";
    }

    private static String joinLongs(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return "(none)";
        return ids.stream().map(String::valueOf).collect(Collectors.joining(", "));
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }
}