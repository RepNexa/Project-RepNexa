package com.repnexa.modules.reports.drilldown;

import com.repnexa.modules.analytics.chemist.ChemistAnalyticsController;
import com.repnexa.modules.analytics.doctor.DoctorAnalyticsController;
import com.repnexa.modules.analytics.product.ProductAnalyticsController;
import com.repnexa.modules.reports.common.ReportBinary;
import com.repnexa.modules.reports.product.ProductDetailsReportExportService;
import com.repnexa.modules.reports.doctor.DoctorDetailsReportExportService;
import com.repnexa.modules.reports.chemist.ChemistDetailsReportExportService;
import com.repnexa.modules.reports.rep.RepDetailsReportExportService;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/reports")
public class DrilldownReportController {

    private final ProductDetailsReportExportService productExports;
    private final DoctorDetailsReportExportService doctorExports;
    private final ChemistDetailsReportExportService chemistExports;
    private final RepDetailsReportExportService repExports;

    public DrilldownReportController(
            ProductDetailsReportExportService productExports,
            DoctorDetailsReportExportService doctorExports,
            ChemistDetailsReportExportService chemistExports,
            RepDetailsReportExportService repExports
    ) {
        this.productExports = productExports;
        this.doctorExports = doctorExports;
        this.chemistExports = chemistExports;
        this.repExports = repExports;
    }

    @PostMapping("/product-details.csv")
    public ResponseEntity<byte[]> exportProductCsv(
            @RequestBody ProductAnalyticsController.ProductDetailsRequest req,
            Authentication auth
    ) {
        return csv(productExports.exportCsv(req, auth));
    }

    @PostMapping(value = "/product-details.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exportProductPdf(
            @RequestBody ProductAnalyticsController.ProductDetailsRequest req,
            Authentication auth
    ) {
        return pdf(productExports.exportPdf(req, auth));
    }

    @PostMapping("/doctor-details.csv")
    public ResponseEntity<byte[]> exportDoctorCsv(
            @RequestBody DoctorAnalyticsController.DoctorDetailsRequest req,
            Authentication auth
    ) {
        return csv(doctorExports.exportCsv(req, auth));
    }

    @PostMapping(value = "/doctor-details.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exportDoctorPdf(
            @RequestBody DoctorAnalyticsController.DoctorDetailsRequest req,
            Authentication auth
    ) {
        return pdf(doctorExports.exportPdf(req, auth));
    }

    @PostMapping("/chemist-details.csv")
    public ResponseEntity<byte[]> exportChemistCsv(
            @RequestBody ChemistAnalyticsController.ChemistDetailsRequest req,
            Authentication auth
    ) {
        return csv(chemistExports.exportCsv(req, auth));
    }

    @PostMapping(value = "/chemist-details.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exportChemistPdf(
            @RequestBody ChemistAnalyticsController.ChemistDetailsRequest req,
            Authentication auth
    ) {
        return pdf(chemistExports.exportPdf(req, auth));
    }

    @PostMapping("/rep-details.csv")
    public ResponseEntity<byte[]> exportRepCsv(
            @RequestBody RepDetailsReportExportService.RepDetailsReportRequest req,
            Authentication auth
    ) {
        return csv(repExports.exportCsv(req, auth));
    }

    @PostMapping(value = "/rep-details.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exportRepPdf(
            @RequestBody RepDetailsReportExportService.RepDetailsReportRequest req,
            Authentication auth
    ) {
        return pdf(repExports.exportPdf(req, auth));
    }

    private ResponseEntity<byte[]> csv(ReportBinary file) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(file.filename()));
        headers.setCacheControl(CacheControl.noStore().getHeaderValue());

        return ResponseEntity.ok()
                .headers(headers)
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(file.bytes());
    }

    private ResponseEntity<byte[]> pdf(ReportBinary file) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(file.filename()));
        headers.setCacheControl(CacheControl.noStore().getHeaderValue());

        return ResponseEntity.ok()
                .headers(headers)
                .contentType(MediaType.APPLICATION_PDF)
                .body(file.bytes());
    }

    private static String contentDisposition(String filename) {
        return "attachment; filename=\"" + filename.replace("\"", "_") + "\"";
    }
}