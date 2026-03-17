package com.repnexa.modules.reports.admin;

import com.repnexa.modules.reports.common.ReportBinary;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminCsvExportController {

    private final AdminCsvExportService exports;

    public AdminCsvExportController(AdminCsvExportService exports) {
        this.exports = exports;
    }

    @GetMapping("/doctors.csv")
    public ResponseEntity<byte[]> doctorsCsv(@RequestParam(name = "q", required = false) String q) {
        return csv(exports.exportDoctors(q));
    }

    @GetMapping("/chemists.csv")
    public ResponseEntity<byte[]> chemistsCsv(@RequestParam(name = "q", required = false) String q) {
        return csv(exports.exportChemists(q));
    }

    @GetMapping("/products.csv")
    public ResponseEntity<byte[]> productsCsv(@RequestParam(name = "q", required = false) String q) {
        return csv(exports.exportProducts(q));
    }

    @GetMapping("/routes.csv")
    public ResponseEntity<byte[]> routesCsv() {
        return csv(exports.exportRoutes());
    }

    @GetMapping("/territories.csv")
    public ResponseEntity<byte[]> territoriesCsv() {
        return csv(exports.exportTerritories());
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

    private static String contentDisposition(String filename) {
        return "attachment; filename=\"" + filename.replace("\"", "_") + "\"";
    }
}