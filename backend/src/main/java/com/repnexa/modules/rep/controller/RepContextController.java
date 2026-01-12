package com.repnexa.modules.rep.controller;

import com.repnexa.modules.assignments.service.ScopeEnforcer;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.dto.RepContextResponse;
import com.repnexa.modules.rep.repo.RepContextJdbcRepository;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/rep")
public class RepContextController {

    private final RepContextJdbcRepository repo;
    private final ScopeEnforcer scope;

    public RepContextController(RepContextJdbcRepository repo, ScopeEnforcer scope) {
        this.repo = repo;
        this.scope = scope;
    }

    @GetMapping("/context")
    public RepContextResponse context(@AuthenticationPrincipal RepnexaUserDetails actor) {
        scope.assertIsMr(actor);

        var rows = repo.findActiveAssignedRoutes(actor.id());
        var routes = rows.stream()
                .map(r -> new RepContextResponse.AssignedRoute(
                        r.repRouteAssignmentId(),
                        r.routeId(),
                        r.routeCode(),
                        r.routeName(),
                        r.territoryId(),
                        r.territoryCode(),
                        r.territoryName()
                ))
                .toList();

        return new RepContextResponse(actor.id(), routes);
    }
}
