package com.repnexa.modules.analytics.company.controller;

import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.CompanyOverviewRequest;
import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.CompanyOverviewResponse;
import com.repnexa.modules.analytics.company.service.CompanyOverviewService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/analytics")
public class CompanyOverviewController {

    private final CompanyOverviewService service;

    public CompanyOverviewController(CompanyOverviewService service) {
        this.service = service;
    }

    @PostMapping("/company-overview")
    public CompanyOverviewResponse companyOverview(@RequestBody CompanyOverviewRequest req, Authentication authentication) {
        return service.compute(req, authentication);
    }
}