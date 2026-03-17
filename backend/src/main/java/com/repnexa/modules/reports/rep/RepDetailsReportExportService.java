package com.repnexa.modules.reports.rep;

import com.repnexa.modules.analytics.rep.RepAnalyticsController;
import com.repnexa.modules.reports.common.CsvWriter;
import com.repnexa.modules.reports.common.ReportBinary;
import com.repnexa.modules.reports.common.ReportFormatters;
import static com.repnexa.modules.reports.common.DashboardPdfModels.*;
import com.repnexa.modules.reports.common.DashboardPdfRenderer;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class RepDetailsReportExportService {

    private final RepAnalyticsController analytics;
    private final Clock clock;

    public RepDetailsReportExportService(RepAnalyticsController analytics, Clock clock) {
        this.analytics = analytics;
        this.clock = clock;
    }

    public record RepDetailsReportRequest(
            RepAnalyticsController.Period period,
            LocalDate dateFrom,
            LocalDate dateTo,
            List<Long> routeIds,
            Long fieldManagerId,
            Long repUserId
    ) {}

    public ReportBinary exportCsv(RepDetailsReportRequest req, Authentication auth) {
        ExportData data = collect(req, auth);
        return new ReportBinary(
                buildCsv(req, data),
                buildFilename("rep-details", req.repUserId(), data.dateFrom(), data.dateTo(), "csv")
        );
    }

    public ReportBinary exportPdf(RepDetailsReportRequest req, Authentication auth) {
        ExportData data = collect(req, auth);
        return new ReportBinary(
                buildPdf(req, data),
                buildFilename("rep-details", req.repUserId(), data.dateFrom(), data.dateTo(), "pdf")
        );
    }

    private ExportData collect(RepDetailsReportRequest req, Authentication auth) {
        DateRange range = resolveDateRange(req);

        var details = analytics.repDetails(
                new RepAnalyticsController.RepDetailsRequest(
                        req.period(),
                        req.dateFrom(),
                        req.dateTo(),
                        req.routeIds(),
                        req.fieldManagerId(),
                        req.repUserId()
                ),
                auth
        );

        List<RepAnalyticsController.RepVisitLogItem> visitLog = List.of();
        if (req.repUserId() != null) {
            visitLog = fetchAllVisitLog(req, range.dateFrom(), range.dateTo(), auth);
        }

        return new ExportData(details, range.dateFrom(), range.dateTo(), visitLog);
    }

    private List<RepAnalyticsController.RepVisitLogItem> fetchAllVisitLog(
            RepDetailsReportRequest req,
            LocalDate dateFrom,
            LocalDate dateTo,
            Authentication auth
    ) {
        var first = analytics.repVisitLog(
                req.repUserId(),
                0,
                50,
                dateFrom,
                dateTo,
                req.routeIds(),
                req.fieldManagerId(),
                auth
        );

        List<RepAnalyticsController.RepVisitLogItem> out = new ArrayList<>(first.items());
        for (int p = 1; p < first.totalPages(); p++) {
            var next = analytics.repVisitLog(
                    req.repUserId(),
                    p,
                    50,
                    dateFrom,
                    dateTo,
                    req.routeIds(),
                    req.fieldManagerId(),
                    auth
            );
            out.addAll(next.items());
        }
        return out;
    }

    private byte[] buildCsv(RepDetailsReportRequest req, ExportData data) {
        CsvWriter csv = new CsvWriter().withUtf8Bom();

        csv.row("Section", "Field", "Value");
        csv.row("Meta", "Date From", ReportFormatters.fmtDate(data.dateFrom()));
        csv.row("Meta", "Date To", ReportFormatters.fmtDate(data.dateTo()));
        csv.row("Meta", "Requested Rep User ID", req.repUserId());
        csv.row("Meta", "Field Manager ID", req.fieldManagerId());
        csv.row("Meta", "Route IDs", ReportFormatters.joinLongs(req.routeIds()));
        csv.row();

        csv.row("Rep Detail Rows");
        csv.row("Rep User ID", "Rep Name", "Visit Count", "Unique Doctors", "Last Visit Date");
        for (var x : data.details().rows()) {
            csv.row(
                    x.repUserId(),
                    x.repName(),
                    x.visitCount(),
                    x.uniqueDoctors(),
                    ReportFormatters.fmtDate(x.lastVisitDate())
            );
        }
        csv.row();

        csv.row("Visit Log");
        csv.row("Call ID", "Call Date", "Route Code", "Route Name", "Doctor ID", "Doctor Name", "Rep User ID", "Rep Username", "Product Codes");
        for (var x : data.visitLog()) {
            csv.row(
                    x.callId(),
                    ReportFormatters.fmtDate(x.callDate()),
                    x.routeCode(),
                    x.routeName(),
                    x.doctorId(),
                    x.doctorName(),
                    x.repUserId(),
                    x.repUsername(),
                    String.join(", ", x.productCodes())
            );
        }

        return csv.toBytes();
    }

    private byte[] buildPdf(RepDetailsReportRequest req, ExportData data) {
        long totalVisits = data.details().rows().stream()
                .mapToLong(x -> x.visitCount())
                .sum();

        long totalUniqueDoctors = data.details().rows().stream()
                .mapToLong(x -> x.uniqueDoctors())
                .sum();

        LocalDate latestVisit = data.details().rows().stream()
                .map(x -> x.lastVisitDate())
                .filter(x -> x != null)
                .max(LocalDate::compareTo)
                .orElse(null);

        List<MetaItem> meta = List.of(
                new MetaItem("Date From", ReportFormatters.fmtDate(data.dateFrom())),
                new MetaItem("Date To", ReportFormatters.fmtDate(data.dateTo())),
                new MetaItem("Requested Rep User ID", ReportFormatters.fmtNum(req.repUserId())),
                new MetaItem("Field Manager ID", ReportFormatters.fmtNum(req.fieldManagerId())),
                new MetaItem("Route IDs", ReportFormatters.joinLongs(req.routeIds()))
        );

        List<KpiItem> heroKpis = List.of(
                new KpiItem("Rep Rows", String.valueOf(data.details().rows().size())),
                new KpiItem("Visit Count", String.valueOf(totalVisits)),
                new KpiItem("Unique Doctors", String.valueOf(totalUniqueDoctors)),
                new KpiItem("Last Visit Date", ReportFormatters.fmtDate(latestVisit))
        );

        List<SectionBlock> sections = new ArrayList<>();

        sections.add(new SectionBlock(
                "Rep Detail Rows",
                List.of(
                        new KpiItem("Visit Log Rows", String.valueOf(data.visitLog().size()))
                ),
                List.of(
                        new TableBlock(
                                "Rep Detail Rows",
                                List.of("Rep User ID", "Rep Name", "Visit Count", "Unique Doctors", "Last Visit Date"),
                                data.details().rows().stream()
                                        .map(x -> List.of(
                                                String.valueOf(x.repUserId()),
                                                ReportFormatters.safe(x.repName()),
                                                String.valueOf(x.visitCount()),
                                                String.valueOf(x.uniqueDoctors()),
                                                ReportFormatters.fmtDate(x.lastVisitDate())
                                        ))
                                        .toList()
                        )
                ),
                List.of(
                        new TextBlock(
                                "Requested Filters",
                                List.of(
                                        "Requested Rep User ID: " + ReportFormatters.fmtNum(req.repUserId()),
                                        "Field Manager ID: " + ReportFormatters.fmtNum(req.fieldManagerId()),
                                        "Route IDs: " + ReportFormatters.joinLongs(req.routeIds())
                                )
                        )
                )
        ));

        sections.add(new SectionBlock(
                "Visit Log",
                List.of(),
                List.of(
                        new TableBlock(
                                "Visit Log",
                                List.of("Call ID", "Call Date", "Route", "Doctor", "Rep Username", "Products"),
                                data.visitLog().stream()
                                        .map(x -> List.of(
                                                String.valueOf(x.callId()),
                                                ReportFormatters.fmtDate(x.callDate()),
                                                ReportFormatters.safe(x.routeCode()),
                                                ReportFormatters.safe(x.doctorName()),
                                                ReportFormatters.safe(x.repUsername()),
                                                String.join(", ", x.productCodes())
                                        ))
                                        .toList()
                        )
                ),
                List.of()
        ));

        DashboardPdfDocument doc = new DashboardPdfDocument(
                "RepNexa Rep Details",
                "Rep analytics export",
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

    private DateRange resolveDateRange(RepDetailsReportRequest req) {
        LocalDate today = LocalDate.now(clock);
        RepAnalyticsController.Period p =
                req.period() == null ? RepAnalyticsController.Period.THIS_MONTH : req.period();

        if (p == RepAnalyticsController.Period.CUSTOM) {
            if (req.dateFrom() != null && req.dateTo() != null) {
                return normalize(req.dateFrom(), req.dateTo());
            }
            p = RepAnalyticsController.Period.THIS_MONTH;
        }

        return switch (p) {
            case THIS_MONTH -> new DateRange(YearMonth.from(today).atDay(1), today);
            case LAST_MONTH -> {
                YearMonth ym = YearMonth.from(today).minusMonths(1);
                yield new DateRange(ym.atDay(1), ym.atEndOfMonth());
            }
            case CUSTOM -> normalize(req.dateFrom(), req.dateTo());
        };
    }

    private DateRange normalize(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new IllegalArgumentException("CUSTOM period requires dateFrom and dateTo");
        }
        if (to.isBefore(from)) {
            return new DateRange(to, from);
        }
        return new DateRange(from, to);
    }

    private record DateRange(LocalDate dateFrom, LocalDate dateTo) {}

    private record ExportData(
            RepAnalyticsController.RepDetailsResponse details,
            LocalDate dateFrom,
            LocalDate dateTo,
            List<RepAnalyticsController.RepVisitLogItem> visitLog
    ) {}
}