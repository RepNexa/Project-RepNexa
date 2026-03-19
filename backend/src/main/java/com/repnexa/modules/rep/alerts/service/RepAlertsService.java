package com.repnexa.modules.rep.alerts.service;

import com.repnexa.modules.assignments.service.ScopeEnforcer;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.alerts.dto.RepAlertsDtos;
import com.repnexa.modules.rep.alerts.repo.RepAlertsJdbcRepository;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.OffsetDateTime;

@Service
public class RepAlertsService {

    private final ScopeEnforcer scope;
    private final RepAlertsJdbcRepository repo;
    private final Clock clock;

    public RepAlertsService(ScopeEnforcer scope,
                            RepAlertsJdbcRepository repo,
                            Clock clock) {
        this.scope = scope;
        this.repo = repo;
        this.clock = clock;
    }

    public RepAlertsDtos.MasterDataAlertsResponse getRecentMasterDataChanges(RepnexaUserDetails actor,
                                                                             long routeId,
                                                                             Integer limit) {
        scope.assertMrHasRoute(actor, routeId);

        int safeLimit = limit == null ? 5 : Math.max(1, Math.min(limit, 10));
        OffsetDateTime cutoff = OffsetDateTime.now(clock).minusDays(30);

        var items = repo.fetchRecentMasterDataChanges(routeId, cutoff, safeLimit).stream()
                .map(x -> new RepAlertsDtos.Item(
                        x.entityType(),
                        x.entityId(),
                        x.title(),
                        x.changeKind(),
                        x.changedAt(),
                        x.subtitle()
                ))
                .toList();

        return new RepAlertsDtos.MasterDataAlertsResponse(routeId, items);
    }
}