package com.repnexa.modules.rep.chemist.controller;

import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.chemist.dto.ChemistReportDtos;
import com.repnexa.modules.rep.chemist.service.ChemistReportService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rep/chemist-reports")
@PreAuthorize("hasRole('MR')")
public class RepChemistReportsController {

    private final ChemistReportService svc;

    public RepChemistReportsController(ChemistReportService svc) {
        this.svc = svc;
    }

    @GetMapping
    public List<ChemistReportDtos.ReportListItem> list(
            @AuthenticationPrincipal RepnexaUserDetails actor
    ) {
        return svc.list(actor);
    }
}
