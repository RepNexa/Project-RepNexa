package com.repnexa.modules.reports.admin;

import com.repnexa.modules.admin.geo.service.AdminGeoService;
import com.repnexa.modules.admin.masterdata.service.AdminChemistService;
import com.repnexa.modules.admin.masterdata.service.AdminDoctorService;
import com.repnexa.modules.admin.masterdata.service.AdminProductService;
import com.repnexa.modules.reports.common.CsvWriter;
import com.repnexa.modules.reports.common.ReportBinary;
import java.time.Clock;
import java.time.LocalDate;
import org.springframework.stereotype.Service;

@Service
public class AdminCsvExportService {

    private final AdminDoctorService doctors;
    private final AdminChemistService chemists;
    private final AdminProductService products;
    private final AdminGeoService geo;
    private final Clock clock;

    public AdminCsvExportService(
            AdminDoctorService doctors,
            AdminChemistService chemists,
            AdminProductService products,
            AdminGeoService geo,
            Clock clock
    ) {
        this.doctors = doctors;
        this.chemists = chemists;
        this.products = products;
        this.geo = geo;
        this.clock = clock;
    }

    public ReportBinary exportDoctors(String q) {
        var rows = doctors.list(q);
        CsvWriter csv = new CsvWriter().withUtf8Bom();
        csv.row("Id", "Name", "Specialty", "Grade", "Status", "Deleted");
        for (var x : rows) {
            csv.row(x.id(), x.name(), x.specialty(), x.grade(), x.status(), x.deleted());
        }
        return new ReportBinary(csv.toBytes(), filename("admin-doctors"));
    }

    public ReportBinary exportChemists(String q) {
        var rows = chemists.list(q);
        CsvWriter csv = new CsvWriter().withUtf8Bom();
        csv.row("Id", "Route Id", "Name", "Deleted");
        for (var x : rows) {
            csv.row(x.id(), x.routeId(), x.name(), x.deleted());
        }
        return new ReportBinary(csv.toBytes(), filename("admin-chemists"));
    }

    public ReportBinary exportProducts(String q) {
        var rows = products.list(q);
        CsvWriter csv = new CsvWriter().withUtf8Bom();
        csv.row("Id", "Code", "Name", "Deleted");
        for (var x : rows) {
            csv.row(x.id(), x.code(), x.name(), x.deleted());
        }
        return new ReportBinary(csv.toBytes(), filename("admin-products"));
    }

    public ReportBinary exportRoutes() {
        var rows = geo.listRoutes();
        CsvWriter csv = new CsvWriter().withUtf8Bom();
        csv.row("Id", "Territory Id", "Territory Code", "Territory Name", "Code", "Name", "Deleted");
        for (var x : rows) {
            csv.row(
                    x.id(),
                    x.territoryId(),
                    x.territoryCode(),
                    x.territoryName(),
                    x.code(),
                    x.name(),
                    x.deleted()
            );
        }
        return new ReportBinary(csv.toBytes(), filename("admin-routes"));
    }

    public ReportBinary exportTerritories() {
        var rows = geo.listTerritories();
        CsvWriter csv = new CsvWriter().withUtf8Bom();
        csv.row("Id", "Code", "Name", "Owner User Id", "Owner Username", "Deleted");
        for (var x : rows) {
            csv.row(
                    x.id(),
                    x.code(),
                    x.name(),
                    x.ownerUserId(),
                    x.ownerUsername(),
                    x.deleted()
            );
        }
        return new ReportBinary(csv.toBytes(), filename("admin-territories"));
    }

    private String filename(String prefix) {
        return prefix + "_" + LocalDate.now(clock) + ".csv";
    }
}