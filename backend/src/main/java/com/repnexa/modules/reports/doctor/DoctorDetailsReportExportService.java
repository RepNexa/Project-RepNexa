package com.repnexa.modules.reports.doctor;

import com.repnexa.modules.analytics.doctor.DoctorAnalyticsController;
import com.repnexa.modules.analytics.doctor.DoctorAnalyticsService;
import com.repnexa.modules.reports.common.CsvWriter;
import com.repnexa.modules.reports.common.ReportBinary;
import com.repnexa.modules.reports.common.ReportFormatters;
import static com.repnexa.modules.reports.common.DashboardPdfModels.*;
import com.repnexa.modules.reports.common.DashboardPdfRenderer;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class DoctorDetailsReportExportService {

    private final DoctorAnalyticsService analytics;
    private final Clock clock;

    public DoctorDetailsReportExportService(DoctorAnalyticsService analytics, Clock clock) {
        this.analytics = analytics;
        this.clock = clock;
    }

    public ReportBinary exportCsv(DoctorAnalyticsController.DoctorDetailsRequest req, Authentication auth) {
        ExportData data = collect(req, auth);
        return new ReportBinary(
                buildCsv(req, data),
                buildFilename("doctor-details", req.doctorId(), data.dateFrom(), data.dateTo(), "csv")
        );
    }

    public ReportBinary exportPdf(DoctorAnalyticsController.DoctorDetailsRequest req, Authentication auth) {
        ExportData data = collect(req, auth);
        return new ReportBinary(
                buildPdf(req, data),
                buildFilename("doctor-details", req.doctorId(), data.dateFrom(), data.dateTo(), "pdf")
        );
    }

    private ExportData collect(DoctorAnalyticsController.DoctorDetailsRequest req, Authentication auth) {
        var details = analytics.doctorDetails(auth, req);
        DateRange range = resolveDateRange(req);

        List<DoctorAnalyticsController.DoctorVisitLogItem> visitLog = List.of();
        if (req.doctorId() != null) {
            visitLog = fetchAllVisitLog(auth, req.doctorId(), req.fieldManagerId(), range.dateFrom(), range.dateTo());
        }

        return new ExportData(details, range.dateFrom(), range.dateTo(), visitLog);
    }

    private List<DoctorAnalyticsController.DoctorVisitLogItem> fetchAllVisitLog(
            Authentication auth,
            long doctorId,
            Long fieldManagerId,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {
        var first = analytics.doctorVisitLog(auth, doctorId, fieldManagerId, 0, 50, dateFrom, dateTo);

        List<DoctorAnalyticsController.DoctorVisitLogItem> out = new ArrayList<>(first.items());
        for (int p = 1; p < first.totalPages(); p++) {
            var next = analytics.doctorVisitLog(auth, doctorId, fieldManagerId, p, 50, dateFrom, dateTo);
            out.addAll(next.items());
        }
        return out;
    }

    private byte[] buildCsv(DoctorAnalyticsController.DoctorDetailsRequest req, ExportData data) {
        CsvWriter csv = new CsvWriter().withUtf8Bom();

        csv.row("Section", "Field", "Value");
        csv.row("Meta", "Date From", ReportFormatters.fmtDate(data.dateFrom()));
        csv.row("Meta", "Date To", ReportFormatters.fmtDate(data.dateTo()));
        csv.row("Meta", "Requested Doctor ID", req.doctorId());
        csv.row("Meta", "Requested Grade", req.grade());
        csv.row("Meta", "Field Manager ID", req.fieldManagerId());
        csv.row("Meta", "Route IDs", ReportFormatters.joinLongs(req.routeIds()));
        csv.row();

        csv.row("Doctor Detail Rows");
        csv.row("Doctor ID", "Doctor Name", "Visit Count", "Last Visit Date");
        for (var x : data.details().rows()) {
            csv.row(
                    x.doctorId(),
                    x.doctorName(),
                    x.visitCount(),
                    ReportFormatters.fmtDate(x.lastVisitDate())
            );
        }
        csv.row();

        csv.row("Visit Log");
        csv.row("Call ID", "Call Date", "Route ID", "Route Code", "Route Name", "Rep User ID", "Rep Username", "Call Type", "Product Codes");
        for (var x : data.visitLog()) {
            csv.row(
                    x.callId(),
                    ReportFormatters.fmtDate(x.callDate()),
                    x.routeId(),
                    x.routeCode(),
                    x.routeName(),
                    x.repUserId(),
                    x.repUsername(),
                    x.callType(),
                    String.join(", ", x.productCodes())
            );
        }

        return csv.toBytes();
    }

    private byte[] buildPdf(DoctorAnalyticsController.DoctorDetailsRequest req, ExportData data) {
        long totalVisits = data.details().rows().stream()
                .mapToLong(x -> x.visitCount())
                .sum();

        LocalDate latestVisit = data.details().rows().stream()
                .map(x -> x.lastVisitDate())
                .filter(x -> x != null)
                .max(LocalDate::compareTo)
                .orElse(null);

        List<MetaItem> meta = List.of(
                new MetaItem("Date From", ReportFormatters.fmtDate(data.dateFrom())),
                new MetaItem("Date To", ReportFormatters.fmtDate(data.dateTo())),
                new MetaItem("Requested Doctor ID", ReportFormatters.fmtNum(req.doctorId())),
                new MetaItem("Requested Grade", ReportFormatters.safe(req.grade())),
                new MetaItem("Field Manager ID", ReportFormatters.fmtNum(req.fieldManagerId())),
                new MetaItem("Route IDs", ReportFormatters.joinLongs(req.routeIds()))
        );

        List<KpiItem> heroKpis = List.of(
                new KpiItem("Doctor Rows", String.valueOf(data.details().rows().size())),
                new KpiItem("Visit Count", String.valueOf(totalVisits)),
                new KpiItem("Visit Log Rows", String.valueOf(data.visitLog().size())),
                new KpiItem("Last Visit Date", ReportFormatters.fmtDate(latestVisit))
        );

        List<SectionBlock> sections = new ArrayList<>();

        sections.add(new SectionBlock(
                "Doctor Detail Rows",
                List.of(),
                List.of(
                        new TableBlock(
                                "Doctor Detail Rows",
                                List.of("Doctor ID", "Doctor Name", "Visit Count", "Last Visit Date"),
                                data.details().rows().stream()
                                        .map(x -> List.of(
                                                String.valueOf(x.doctorId()),
                                                ReportFormatters.safe(x.doctorName()),
                                                String.valueOf(x.visitCount()),
                                                ReportFormatters.fmtDate(x.lastVisitDate())
                                        ))
                                        .toList()
                        )
                ),
                List.of(
                        new TextBlock(
                                "Requested Filters",
                                List.of(
                                        "Requested Doctor ID: " + ReportFormatters.fmtNum(req.doctorId()),
                                        "Requested Grade: " + ReportFormatters.safe(req.grade()),
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
                                List.of("Call ID", "Call Date", "Route", "Rep", "Call Type", "Products"),
                                data.visitLog().stream()
                                        .map(x -> List.of(
                                                String.valueOf(x.callId()),
                                                ReportFormatters.fmtDate(x.callDate()),
                                                ReportFormatters.safe(x.routeCode()),
                                                ReportFormatters.safe(x.repUsername()),
                                                ReportFormatters.safe(x.callType()),
                                                String.join(", ", x.productCodes())
                                        ))
                                        .toList()
                        )
                ),
                List.of()
        ));

        DashboardPdfDocument doc = new DashboardPdfDocument(
                "RepNexa Doctor Details",
                "Doctor analytics export",
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

    private DateRange resolveDateRange(DoctorAnalyticsController.DoctorDetailsRequest req) {
        LocalDate today = LocalDate.now(clock);
        DoctorAnalyticsController.Period p =
                req.period() == null ? DoctorAnalyticsController.Period.THIS_MONTH : req.period();

        if (p == DoctorAnalyticsController.Period.CUSTOM) {
            if (req.dateFrom() != null && req.dateTo() != null) {
                return normalize(req.dateFrom(), req.dateTo());
            }
            p = DoctorAnalyticsController.Period.THIS_MONTH;
        }

        return switch (p) {
            case THIS_MONTH -> new DateRange(today.withDayOfMonth(1), today);
            case LAST_MONTH -> {
                LocalDate firstOfThisMonth = today.withDayOfMonth(1);
                yield new DateRange(firstOfThisMonth.minusMonths(1), firstOfThisMonth.minusDays(1));
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
            DoctorAnalyticsController.DoctorDetailsResponse details,
            LocalDate dateFrom,
            LocalDate dateTo,
            List<DoctorAnalyticsController.DoctorVisitLogItem> visitLog
    ) {}
}