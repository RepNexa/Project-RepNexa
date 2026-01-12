package com.repnexa.modules.rep.controller;

import com.repnexa.modules.assignments.service.ScopeEnforcer;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.repo.RepTypeaheadJdbcRepository;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rep")
public class RepTypeaheadController {

    private final ScopeEnforcer scope;
    private final RepTypeaheadJdbcRepository repo;

    public RepTypeaheadController(ScopeEnforcer scope, RepTypeaheadJdbcRepository repo) {
        this.scope = scope;
        this.repo = repo;
    }

    @GetMapping("/doctors")
    public List<RepTypeaheadJdbcRepository.DoctorItem> doctors(
            @AuthenticationPrincipal RepnexaUserDetails actor,
            @RequestParam long routeId,
            @RequestParam(name = "q", required = false) String q
    ) {
        scope.assertMrHasRoute(actor, routeId);
        return repo.doctorsByRoute(routeId, q, 20);
    }

    @GetMapping("/chemists")
    public List<RepTypeaheadJdbcRepository.ChemistItem> chemists(
            @AuthenticationPrincipal RepnexaUserDetails actor,
            @RequestParam long routeId,
            @RequestParam(name = "q", required = false) String q
    ) {
        scope.assertMrHasRoute(actor, routeId);
        return repo.chemistsByRoute(routeId, q, 20);
    }
}
