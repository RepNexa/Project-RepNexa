package com.repnexa.modules.reports.company;

import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.CompanyOverviewRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/reports")
public class CompanyOverviewReportController {

    private final CompanyOverviewReportExportService exportService;

    public CompanyOverviewReportController(CompanyOverviewReportExportService exportService) {
        this.exportService = exportService;
    }

    @PostMapping(value = "/company-overview.csv")
    public ResponseEntity<byte[]> exportCompanyOverviewCsv(
            @RequestBody CompanyOverviewRequest req,
            Authentication auth
    ) {
        var file = exportService.exportCsv(req, auth);

        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(file.filename()));
        headers.setCacheControl(CacheControl.noStore().getHeaderValue());

        return ResponseEntity.ok()
                .headers(headers)
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(file.bytes());
    }

    @PostMapping(value = "/company-overview.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exportCompanyOverviewPdf(
            @RequestBody CompanyOverviewRequest req,
            Authentication auth
    ) {
        var file = exportService.exportPdf(req, auth);

        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(file.filename()));
        headers.setCacheControl(CacheControl.noStore().getHeaderValue());

        return ResponseEntity.ok()
                .headers(headers)
                .contentType(MediaType.APPLICATION_PDF)
                .body(file.bytes());
    }

    private static String contentDisposition(String filename) {
        // Keep ASCII-safe for now (Phase 1)
        return "attachment; filename=\"" + filename.replace("\"", "_") + "\"";
    }
}