package com.repnexa.modules.reports.product;

import com.repnexa.modules.analytics.product.ProductAnalyticsController;
import com.repnexa.modules.reports.common.CsvWriter;
import com.repnexa.modules.reports.common.ReportBinary;
import com.repnexa.modules.reports.common.ReportFormatters;
import com.repnexa.modules.reports.common.SimplePdfReportRenderer;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import static com.repnexa.modules.reports.common.DashboardPdfModels.*;
import com.repnexa.modules.reports.common.DashboardPdfRenderer;

@Service
public class ProductDetailsReportExportService {

    private final ProductAnalyticsController analytics;

    public ProductDetailsReportExportService(ProductAnalyticsController analytics) {
        this.analytics = analytics;
    }

    public ReportBinary exportCsv(ProductAnalyticsController.ProductDetailsRequest req, Authentication auth) {
        ExportData data = collect(req, auth);
        return new ReportBinary(
                buildCsv(req, data),
                buildFilename("product-details", req.productId(), data.details().periodUsed().dateFrom(), data.details().periodUsed().dateTo(), "csv")
        );
    }

    public ReportBinary exportPdf(ProductAnalyticsController.ProductDetailsRequest req, Authentication auth) {
        ExportData data = collect(req, auth);
        return new ReportBinary(
                buildPdf(req, data),
                buildFilename("product-details", req.productId(), data.details().periodUsed().dateFrom(), data.details().periodUsed().dateTo(), "pdf")
        );
    }

    private ExportData collect(ProductAnalyticsController.ProductDetailsRequest req, Authentication auth) {
        var details = analytics.productDetails(req, auth);

        List<ProductAnalyticsController.PointDate> callsOverTime = List.of();
        List<ProductAnalyticsController.GradePoint> coverageByGrade = List.of();
        List<ProductAnalyticsController.ProductTopDoctorRow> topDoctors = List.of();
        List<ProductAnalyticsController.ProductOosChemistRow> oosChemists = List.of();

        if (req.productId() != null && details.product() != null) {
            LocalDate df = details.periodUsed().dateFrom();
            LocalDate dt = details.periodUsed().dateTo();

            callsOverTime = analytics.callsOverTime(
                    req.productId(),
                    df,
                    dt,
                    req.routeIds(),
                    req.fieldManagerId(),
                    auth
            );

            coverageByGrade = analytics.coverageByGrade(
                    req.productId(),
                    df,
                    dt,
                    req.routeIds(),
                    req.fieldManagerId(),
                    auth
            );

            topDoctors = fetchAllTopDoctors(req, df, dt, auth);
            oosChemists = fetchAllOosChemists(req, df, dt, auth);
        }

        return new ExportData(details, callsOverTime, coverageByGrade, topDoctors, oosChemists);
    }

    private List<ProductAnalyticsController.ProductTopDoctorRow> fetchAllTopDoctors(
            ProductAnalyticsController.ProductDetailsRequest req,
            LocalDate df,
            LocalDate dt,
            Authentication auth
    ) {
        var first = analytics.topDoctors(
                req.productId(),
                0,
                50,
                df,
                dt,
                req.routeIds(),
                req.fieldManagerId(),
                auth
        );

        List<ProductAnalyticsController.ProductTopDoctorRow> out = new ArrayList<>(first.items());
        for (int p = 1; p < first.totalPages(); p++) {
            var next = analytics.topDoctors(
                    req.productId(),
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

    private List<ProductAnalyticsController.ProductOosChemistRow> fetchAllOosChemists(
            ProductAnalyticsController.ProductDetailsRequest req,
            LocalDate df,
            LocalDate dt,
            Authentication auth
    ) {
        var first = analytics.oosChemists(
                req.productId(),
                0,
                50,
                df,
                dt,
                req.routeIds(),
                req.fieldManagerId(),
                auth
        );

        List<ProductAnalyticsController.ProductOosChemistRow> out = new ArrayList<>(first.items());
        for (int p = 1; p < first.totalPages(); p++) {
            var next = analytics.oosChemists(
                    req.productId(),
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

    private byte[] buildCsv(ProductAnalyticsController.ProductDetailsRequest req, ExportData data) {
        var d = data.details();
        var product = d.product();

        CsvWriter csv = new CsvWriter().withUtf8Bom();

        csv.row("Section", "Field", "Value");
        csv.row("Meta", "Date From", ReportFormatters.fmtDate(d.periodUsed().dateFrom()));
        csv.row("Meta", "Date To", ReportFormatters.fmtDate(d.periodUsed().dateTo()));
        csv.row("Meta", "Requested Product ID", req.productId());
        csv.row("Meta", "Field Manager ID", req.fieldManagerId());
        csv.row("Meta", "Route IDs", ReportFormatters.joinLongs(req.routeIds()));
        csv.row();

        csv.row("Summary");
        csv.row("Field", "Value");
        csv.row("Product ID", product != null ? product.id() : null);
        csv.row("Product Code", product != null ? product.code() : null);
        csv.row("Product Name", product != null ? product.name() : null);
        csv.row("Effective Route Count", d.effectiveRouteCount());
        csv.row("Visit Count", d.visitCount());
        csv.row("Unique Doctors", d.uniqueDoctors());
        csv.row("OOS Count", d.oosCount());
        csv.row("LOW Count", d.lowCount());
        csv.row("Last Detailed Date", ReportFormatters.fmtDate(d.lastDetailedDate()));
        csv.row();

        csv.row("Calls Over Time");
        csv.row("Bucket", "Calls");
        for (var x : data.callsOverTime()) {
            csv.row(ReportFormatters.fmtDate(x.x()), x.y());
        }
        csv.row();

        csv.row("Coverage By Grade");
        csv.row("Grade", "Count");
        for (var x : data.coverageByGrade()) {
            csv.row(x.grade(), x.count());
        }
        csv.row();

        csv.row("Top Doctors");
        csv.row("Doctor ID", "Doctor Name", "Grade", "Call Count", "Last Detailed Date");
        for (var x : data.topDoctors()) {
            csv.row(
                    x.doctorId(),
                    x.doctorName(),
                    x.grade(),
                    x.callCount(),
                    ReportFormatters.fmtDate(x.lastDetailed())
            );
        }
        csv.row();

        csv.row("OOS Chemists");
        csv.row("Chemist ID", "Chemist Name", "Route Name", "OOS Events", "Last OOS Date");
        for (var x : data.oosChemists()) {
            csv.row(
                    x.chemistId(),
                    x.chemistName(),
                    x.routeName(),
                    x.oosEvents(),
                    ReportFormatters.fmtDate(x.lastOosDate())
            );
        }

        return csv.toBytes();
    }

    private byte[] buildPdf(ProductAnalyticsController.ProductDetailsRequest req, ExportData data) {
        var d = data.details();
        var product = d.product();

        List<MetaItem> meta = List.of(
                new MetaItem("Date From", ReportFormatters.fmtDate(d.periodUsed().dateFrom())),
                new MetaItem("Date To", ReportFormatters.fmtDate(d.periodUsed().dateTo())),
                new MetaItem("Requested Product ID", ReportFormatters.fmtNum(req.productId())),
                new MetaItem("Field Manager ID", ReportFormatters.fmtNum(req.fieldManagerId())),
                new MetaItem("Route IDs", ReportFormatters.joinLongs(req.routeIds()))
        );

        List<KpiItem> heroKpis = List.of(
                new KpiItem("Visit Count", String.valueOf(d.visitCount())),
                new KpiItem("Unique Doctors", String.valueOf(d.uniqueDoctors())),
                new KpiItem("OOS Count", String.valueOf(d.oosCount())),
                new KpiItem("LOW Count", String.valueOf(d.lowCount()))
        );

        List<SectionBlock> sections = new ArrayList<>();

        sections.add(new SectionBlock(
                "Product Summary",
                List.of(
                        new KpiItem("Product Code", product != null ? ReportFormatters.safe(product.code()) : "N/A"),
                        new KpiItem("Effective Route Count", String.valueOf(d.effectiveRouteCount())),
                        new KpiItem("Last Detailed Date", ReportFormatters.fmtDate(d.lastDetailedDate()))
                ),
                List.of(),
                List.of(
                        new TextBlock(
                                "Selected Product",
                                List.of(
                                        "Product ID: " + (product != null ? product.id() : "N/A"),
                                        "Product Name: " + (product != null ? ReportFormatters.safe(product.name()) : "N/A")
                                )
                        )
                )
        ));

        sections.add(new SectionBlock(
                "Coverage & Activity",
                List.of(),
                List.of(
                        new TableBlock(
                                "Calls Over Time",
                                List.of("Bucket", "Calls"),
                                data.callsOverTime().stream()
                                        .map(x -> List.of(
                                                ReportFormatters.fmtDate(x.x()),
                                                String.valueOf(x.y())
                                        ))
                                        .toList()
                        ),
                        new TableBlock(
                                "Coverage By Grade",
                                List.of("Grade", "Count"),
                                data.coverageByGrade().stream()
                                        .map(x -> List.of(
                                                ReportFormatters.safe(x.grade()),
                                                String.valueOf(x.count())
                                        ))
                                        .toList()
                        )
                ),
                List.of()
        ));

        sections.add(new SectionBlock(
                "Top Doctors",
                List.of(),
                List.of(
                        new TableBlock(
                                "Top Doctors",
                                List.of("Doctor ID", "Doctor Name", "Grade", "Calls", "Last Detailed"),
                                data.topDoctors().stream()
                                        .map(x -> List.of(
                                                String.valueOf(x.doctorId()),
                                                ReportFormatters.safe(x.doctorName()),
                                                ReportFormatters.safe(x.grade()),
                                                String.valueOf(x.callCount()),
                                                ReportFormatters.fmtDate(x.lastDetailed())
                                        ))
                                        .toList()
                        )
                ),
                List.of()
        ));

        sections.add(new SectionBlock(
                "OOS Chemists",
                List.of(),
                List.of(
                        new TableBlock(
                                "OOS Chemist Leaderboard",
                                List.of("Chemist ID", "Chemist Name", "Route", "OOS Events", "Last OOS"),
                                data.oosChemists().stream()
                                        .map(x -> List.of(
                                                String.valueOf(x.chemistId()),
                                                ReportFormatters.safe(x.chemistName()),
                                                ReportFormatters.safe(x.routeName()),
                                                String.valueOf(x.oosEvents()),
                                                ReportFormatters.fmtDate(x.lastOosDate())
                                        ))
                                        .toList()
                        )
                ),
                List.of()
        ));

        DashboardPdfDocument doc = new DashboardPdfDocument(
                "RepNexa Product Details",
                "Product analytics export",
                meta,
                heroKpis,
                sections,
                "RepNexa | CM export"
        );

        return DashboardPdfRenderer.render(doc);
    }

    private String buildFilename(String prefix, Long entityId, LocalDate from, LocalDate to, String ext) {
        String suffix = entityId == null ? "" : "_id-" + entityId;
        return prefix + suffix + "_" + ReportFormatters.fmtDate(from) + "_to_" + ReportFormatters.fmtDate(to) + "." + ext;
    }

    private record ExportData(
            ProductAnalyticsController.ProductDetailsResponse details,
            List<ProductAnalyticsController.PointDate> callsOverTime,
            List<ProductAnalyticsController.GradePoint> coverageByGrade,
            List<ProductAnalyticsController.ProductTopDoctorRow> topDoctors,
            List<ProductAnalyticsController.ProductOosChemistRow> oosChemists
    ) {}
}