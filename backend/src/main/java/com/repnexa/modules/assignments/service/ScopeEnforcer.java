package com.repnexa.modules.assignments.service;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.auth.domain.UserRole;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.assignments.repo.ScopeJdbcRepository;
import org.springframework.stereotype.Component;

@Component
public class ScopeEnforcer {

    private final ScopeJdbcRepository scopeJdbc;

    public ScopeEnforcer(ScopeJdbcRepository scopeJdbc) {
        this.scopeJdbc = scopeJdbc;
    }

    public void assertCanManageRoute(RepnexaUserDetails actor, long routeId) {
        if (actor.role() == UserRole.CM) return;
        if (actor.role() == UserRole.FM) {
            if (scopeJdbc.isRouteOwnedByFm(actor.id(), routeId)) return;
            throw ApiException.forbidden("SCOPE_FORBIDDEN", "Route is outside your territory scope");
        }
        throw ApiException.forbidden("FORBIDDEN", "Access denied");
    }

    public void assertIsMr(RepnexaUserDetails actor) {
        if (actor.role() != UserRole.MR) {
            throw ApiException.forbidden("FORBIDDEN", "Access denied");
        }
    }


    public void assertMrHasRoute(RepnexaUserDetails actor, long routeId) {
        assertIsMr(actor);
        if (!scopeJdbc.isRouteAssignedToMr(actor.id(), routeId)) {
            throw ApiException.forbidden("SCOPE_FORBIDDEN", "Route is not assigned to you");
        }
    }
}
