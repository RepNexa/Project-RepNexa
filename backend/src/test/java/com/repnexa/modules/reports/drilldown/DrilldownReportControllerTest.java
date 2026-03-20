package com.repnexa.modules.reports.drilldown;

import com.repnexa.modules.analytics.doctor.DoctorAnalyticsController;
import com.repnexa.modules.analytics.rep.RepAnalyticsController;
import com.repnexa.modules.reports.chemist.ChemistDetailsReportExportService;
import com.repnexa.modules.reports.common.ReportBinary;
import com.repnexa.modules.reports.doctor.DoctorDetailsReportExportService;
import com.repnexa.modules.reports.product.ProductDetailsReportExportService;
import com.repnexa.modules.reports.rep.RepDetailsReportExportService;
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
class DrilldownReportControllerTest {

    @Mock ProductDetailsReportExportService productExports;
    @Mock DoctorDetailsReportExportService doctorExports;
    @Mock ChemistDetailsReportExportService chemistExports;
    @Mock RepDetailsReportExportService repExports;

    @Test
    void export_doctor_details_csv_sets_attachment_headers_and_csv_content_type() {
        byte[] bytes = "doctorId,doctorName\r\n1,Alice".getBytes(StandardCharsets.UTF_8);
        when(doctorExports.exportCsv(any(DoctorAnalyticsController.DoctorDetailsRequest.class), ArgumentMatchers.<Authentication>isNull()))
                .thenReturn(new ReportBinary(bytes, "doctor-details.csv"));

        DrilldownReportController controller = new DrilldownReportController(productExports, doctorExports, chemistExports, repExports);
        ResponseEntity<byte[]> response = controller.exportDoctorCsv(
                new DoctorAnalyticsController.DoctorDetailsRequest(
                        DoctorAnalyticsController.Period.THIS_MONTH,
                        null,
                        null,
                        null,
                        null,
                        1L,
                        null
                ),
                null
        );

        assertEquals("attachment; filename=\"doctor-details.csv\"", response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION));
        assertEquals("no-store", response.getHeaders().getCacheControl());
        assertEquals(MediaType.parseMediaType("text/csv; charset=UTF-8"), response.getHeaders().getContentType());
        assertArrayEquals(bytes, response.getBody());
    }

    @Test
    void export_rep_details_pdf_sets_attachment_headers_and_pdf_content_type() {
        byte[] bytes = "%PDF-rep".getBytes(StandardCharsets.ISO_8859_1);
        when(repExports.exportPdf(any(RepDetailsReportExportService.RepDetailsReportRequest.class), ArgumentMatchers.<Authentication>isNull()))
                .thenReturn(new ReportBinary(bytes, "rep-details.pdf"));

        DrilldownReportController controller = new DrilldownReportController(productExports, doctorExports, chemistExports, repExports);
        ResponseEntity<byte[]> response = controller.exportRepPdf(
                new RepDetailsReportExportService.RepDetailsReportRequest(
                        RepAnalyticsController.Period.THIS_MONTH,
                        null,
                        null,
                        null,
                        null,
                        9L
                ),
                null
        );

        assertEquals("attachment; filename=\"rep-details.pdf\"", response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION));
        assertEquals("no-store", response.getHeaders().getCacheControl());
        assertEquals(MediaType.APPLICATION_PDF, response.getHeaders().getContentType());
        assertArrayEquals(bytes, response.getBody());
    }
}