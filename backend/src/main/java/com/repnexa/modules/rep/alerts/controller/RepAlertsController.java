package com.repnexa.modules.rep.alerts.controller;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.alerts.dto.RepAlertsDtos;
import com.repnexa.modules.rep.alerts.service.RepAlertsService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rep/alerts")
public class RepAlertsController {

    private final RepAlertsService service;

    public RepAlertsController(RepAlertsService service) {
        this.service = service;
    }

    @GetMapping("/master-data")
    public RepAlertsDtos.MasterDataAlertsResponse masterData(@AuthenticationPrincipal RepnexaUserDetails actor,
                                                             @RequestParam(value = "routeId", required = false) Long routeId,
                                                             @RequestParam(value = "limit", required = false) Integer limit) {
        if (actor == null) {
            throw ApiException.unauthorized("AUTH_REQUIRED", "Authentication required");
        }
        if (routeId == null || routeId <= 0) {
            throw ApiException.badRequest("VALIDATION_ERROR", "routeId is required");
        }

        return service.getRecentMasterDataChanges(actor, routeId, limit);
    }
}