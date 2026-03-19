package com.repnexa.modules.reports.company;

import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CompanyOverviewReportControllerTest {

    @Mock CompanyOverviewReportExportService exportService;

    @Test
    void export_company_overview_csv_sets_attachment_headers_and_csv_content_type() {
        byte[] bytes = "col1,col2\r\n1,2".getBytes(StandardCharsets.UTF_8);
        when(exportService.exportCsv(any(CompanyOverviewDtos.CompanyOverviewRequest.class), ArgumentMatchers.<Authentication>isNull()))
                .thenReturn(new CompanyOverviewReportExportService.ReportBinary(bytes, "company-overview.csv"));

        CompanyOverviewReportController controller = new CompanyOverviewReportController(exportService);
        ResponseEntity<byte[]> response = controller.exportCompanyOverviewCsv(
                new CompanyOverviewDtos.CompanyOverviewRequest(
                        CompanyOverviewDtos.Period.THIS_MONTH,
                        null,
                        null,
                        null,
                        null,
                        null
                ),
                null
        );

        assertEquals("attachment; filename=\"company-overview.csv\"", response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION));
        assertEquals("no-store", response.getHeaders().getCacheControl());
        assertEquals(MediaType.parseMediaType("text/csv; charset=UTF-8"), response.getHeaders().getContentType());
        assertArrayEquals(bytes, response.getBody());
    }

    @Test
    void export_company_overview_pdf_sets_attachment_headers_and_pdf_content_type() {
        byte[] bytes = "%PDF-demo".getBytes(StandardCharsets.ISO_8859_1);
        when(exportService.exportPdf(any(CompanyOverviewDtos.CompanyOverviewRequest.class), ArgumentMatchers.<Authentication>isNull()))
                .thenReturn(new CompanyOverviewReportExportService.ReportBinary(bytes, "company-overview.pdf"));

        CompanyOverviewReportController controller = new CompanyOverviewReportController(exportService);
        ResponseEntity<byte[]> response = controller.exportCompanyOverviewPdf(
                new CompanyOverviewDtos.CompanyOverviewRequest(
                        CompanyOverviewDtos.Period.THIS_MONTH,
                        null,
                        null,
                        null,
                        null,
                        null
                ),
                null
        );

        assertEquals("attachment; filename=\"company-overview.pdf\"", response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION));
        assertEquals("no-store", response.getHeaders().getCacheControl());
        assertEquals(MediaType.APPLICATION_PDF, response.getHeaders().getContentType());
        assertArrayEquals(bytes, response.getBody());
    }
}
