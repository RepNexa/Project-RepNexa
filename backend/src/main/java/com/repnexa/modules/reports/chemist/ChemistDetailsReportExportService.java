package com.repnexa.modules.reports.chemist;

import com.repnexa.modules.analytics.chemist.ChemistAnalyticsController;
import com.repnexa.modules.reports.common.CsvWriter;
import com.repnexa.modules.reports.common.ReportBinary;
import com.repnexa.modules.reports.common.ReportFormatters;
import static com.repnexa.modules.reports.common.DashboardPdfModels.*;
import com.repnexa.modules.reports.common.DashboardPdfRenderer;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class ChemistDetailsReportExportService {

    private final ChemistAnalyticsController analytics;

    public ChemistDetailsReportExportService(ChemistAnalyticsController analytics) {
        this.analytics = analytics;
    }

    public ReportBinary exportCsv(ChemistAnalyticsController.ChemistDetailsRequest req, Authentication auth) {
        ExportData data = collect(req, auth);
        return new ReportBinary(
                buildCsv(req, data),
                buildFilename("chemist-details", req.chemistId(), data.details().periodUsed().dateFrom(), data.details().periodUsed().dateTo(), "csv")
        );
    }

    public ReportBinary exportPdf(ChemistAnalyticsController.ChemistDetailsRequest req, Authentication auth) {
        ExportData data = collect(req, auth);
        return new ReportBinary(
                buildPdf(req, data),
                buildFilename("chemist-details", req.chemistId(), data.details().periodUsed().dateFrom(), data.details().periodUsed().dateTo(), "pdf")
        );
    }

    private ExportData collect(ChemistAnalyticsController.ChemistDetailsRequest req, Authentication auth) {
        var details = analytics.chemistDetails(req, auth);

        List<ChemistAnalyticsController.PointDate> visitsOverTime = List.of();
        List<ChemistAnalyticsController.ChemistVisitLogItem> visitLog = List.of();

        if (req.chemistId() != null && details.chemist() != null) {
            LocalDate df = details.periodUsed().dateFrom();
            LocalDate dt = details.periodUsed().dateTo();

            visitsOverTime = analytics.chemistVisitsOverTime(
                    req.chemistId(),
                    df,
                    dt,
                    req.routeIds(),
                    req.fieldManagerId(),
                    auth
            );

            visitLog = fetchAllVisitLog(req, df, dt, auth);
        }

        return new ExportData(details, visitsOverTime, visitLog);
    }

    private List<ChemistAnalyticsController.ChemistVisitLogItem> fetchAllVisitLog(
            ChemistAnalyticsController.ChemistDetailsRequest req,
            LocalDate df,
            LocalDate dt,
            Authentication auth
    ) {
        var first = analytics.chemistVisitLog(
                req.chemistId(),
                0,
                50,
                df,
                dt,
                req.routeIds(),
                req.fieldManagerId(),
                auth
        );

        List<ChemistAnalyticsController.ChemistVisitLogItem> out = new ArrayList<>(first.items());
        for (int p = 1; p < first.totalPages(); p++) {
            var next = analytics.chemistVisitLog(
                    req.chemistId(),
                    p,
                    50,
                    df,
                    dt,
                    req.routeIds(),
                    req.fieldManagerId(),
                    auth
            );
            out.addAll(next.items());
        }
        return out;
    }

    private byte[] buildCsv(ChemistAnalyticsController.ChemistDetailsRequest req, ExportData data) {
        var d = data.details();
        var chemist = d.chemist();

        CsvWriter csv = new CsvWriter().withUtf8Bom();

        csv.row("Section", "Field", "Value");
        csv.row("Meta", "Date From", ReportFormatters.fmtDate(d.periodUsed().dateFrom()));
        csv.row("Meta", "Date To", ReportFormatters.fmtDate(d.periodUsed().dateTo()));
        csv.row("Meta", "Requested Chemist ID", req.chemistId());
        csv.row("Meta", "Field Manager ID", req.fieldManagerId());
        csv.row("Meta", "Route IDs", ReportFormatters.joinLongs(req.routeIds()));
        csv.row();

        csv.row("Summary");
        csv.row("Field", "Value");
        csv.row("Chemist ID", chemist != null ? chemist.id() : null);
        csv.row("Chemist Name", chemist != null ? chemist.name() : null);
        csv.row("Chemist Route ID", chemist != null ? chemist.routeId() : null);
        csv.row("Effective Route Count", d.effectiveRouteCount());
        csv.row("Visit Count", d.visitCount());
        csv.row();

        csv.row("OOS By Product");
        csv.row("Product", "Count");
        for (var x : d.oosByProduct()) {
            csv.row(x.key(), x.count());
        }
        csv.row();

        csv.row("LOW By Product");
        csv.row("Product", "Count");
        for (var x : d.lowByProduct()) {
            csv.row(x.key(), x.count());
        }
        csv.row();

        csv.row("Visits Over Time");
        csv.row("Bucket", "Visits");
        for (var x : data.visitsOverTime()) {
            csv.row(ReportFormatters.fmtDate(x.x()), x.y());
        }
        csv.row();

        csv.row("Visit Log");
        csv.row("Visit ID", "Visit Date", "Route Code", "Route Name", "Rep Username", "OOS Product Codes", "LOW Product Codes");
        for (var x : data.visitLog()) {
            csv.row(
                    x.visitId(),
                    ReportFormatters.fmtDate(x.visitDate()),
                    x.routeCode(),
                    x.routeName(),
                    x.repUsername(),
                    String.join(", ", x.oosProductCodes()),
                    String.join(", ", x.lowProductCodes())
            );
        }

        return csv.toBytes();
    }

    private byte[] buildPdf(ChemistAnalyticsController.ChemistDetailsRequest req, ExportData data) {
        var d = data.details();
        var chemist = d.chemist();

        long totalOosEvents = d.oosByProduct().stream()
                .mapToLong(x -> x.count())
                .sum();

        long totalLowEvents = d.lowByProduct().stream()
                .mapToLong(x -> x.count())
                .sum();

        List<MetaItem> meta = List.of(
                new MetaItem("Date From", ReportFormatters.fmtDate(d.periodUsed().dateFrom())),
                new MetaItem("Date To", ReportFormatters.fmtDate(d.periodUsed().dateTo())),
                new MetaItem("Requested Chemist ID", ReportFormatters.fmtNum(req.chemistId())),
                new MetaItem("Field Manager ID", ReportFormatters.fmtNum(req.fieldManagerId())),
                new MetaItem("Route IDs", ReportFormatters.joinLongs(req.routeIds()))
        );

        List<KpiItem> heroKpis = List.of(
                new KpiItem("Visit Count", String.valueOf(d.visitCount())),
                new KpiItem("Effective Route Count", String.valueOf(d.effectiveRouteCount())),
                new KpiItem("OOS Events", String.valueOf(totalOosEvents)),
                new KpiItem("LOW Events", String.valueOf(totalLowEvents))
        );

        List<SectionBlock> sections = new ArrayList<>();

        sections.add(new SectionBlock(
                "Chemist Summary",
                List.of(
                        new KpiItem("Chemist Route ID", chemist != null ? String.valueOf(chemist.routeId()) : "N/A")
                ),
                List.of(),
                List.of(
                        new TextBlock(
                                "Selected Chemist",
                                List.of(
                                        "Chemist ID: " + (chemist != null ? chemist.id() : "N/A"),
                                        "Chemist Name: " + (chemist != null ? ReportFormatters.safe(chemist.name()) : "N/A")
                                )
                        )
                )
        ));

        sections.add(new SectionBlock(
                "OOS By Product",
                List.of(),
                List.of(
                        new TableBlock(
                                "OOS By Product",
                                List.of("Product", "Count"),
                                d.oosByProduct().stream()
                                        .map(x -> List.of(
                                                ReportFormatters.safe(x.key()),
                                                String.valueOf(x.count())
                                        ))
                                        .toList()
                        )
                ),
                List.of()
        ));

        sections.add(new SectionBlock(
                "LOW By Product",
                List.of(),
                List.of(
                        new TableBlock(
                                "LOW By Product",
                                List.of("Product", "Count"),
                                d.lowByProduct().stream()
                                        .map(x -> List.of(
                                                ReportFormatters.safe(x.key()),
                                                String.valueOf(x.count())
                                        ))
                                        .toList()
                        )
                ),
                List.of()
        ));

        sections.add(new SectionBlock(
                "Visits Over Time",
                List.of(),
                List.of(
                        new TableBlock(
                                "Visits Over Time",
                                List.of("Bucket", "Visits"),
                                data.visitsOverTime().stream()
                                        .map(x -> List.of(
                                                ReportFormatters.fmtDate(x.x()),
                                                String.valueOf(x.y())
                                        ))
                                        .toList()
                        )
                ),
                List.of()
        ));

        sections.add(new SectionBlock(
                "Visit Log",
                List.of(),
                List.of(
                        new TableBlock(
                                "Visit Log",
                                List.of("Visit ID", "Visit Date", "Route", "Rep", "OOS Products", "LOW Products"),
                                data.visitLog().stream()
                                        .map(x -> List.of(
                                                String.valueOf(x.visitId()),
                                                ReportFormatters.fmtDate(x.visitDate()),
                                                ReportFormatters.safe(x.routeCode()),
                                                ReportFormatters.safe(x.repUsername()),
                                                String.join(", ", x.oosProductCodes()),
                                                String.join(", ", x.lowProductCodes())
                                        ))
                                        .toList()
                        )
                ),
                List.of()
        ));

        DashboardPdfDocument doc = new DashboardPdfDocument(
                "RepNexa Chemist Details",
                "Chemist analytics export",
                meta,
                heroKpis,
                sections,
                "RepNexa | CM/FM export"
        );

        return DashboardPdfRenderer.render(doc);
    }

    private String buildFilename(String prefix, Long entityId, LocalDate from, LocalDate to, String ext) {
        String suffix = entityId == null ? "" : "_id-" + entityId;
        return prefix + suffix + "_" + ReportFormatters.fmtDate(from) + "_to_" + ReportFormatters.fmtDate(to) + "." + ext;
    }

    private record ExportData(
            ChemistAnalyticsController.ChemistDetailsResponse details,
            List<ChemistAnalyticsController.PointDate> visitsOverTime,
            List<ChemistAnalyticsController.ChemistVisitLogItem> visitLog
    ) {}
}