package com.repnexa.modules.rep.dto;

import java.util.List;

public record RepContextResponse(
        long repUserId,
        List<AssignedRoute> routes
) {
    public record AssignedRoute(
            long repRouteAssignmentId,
            long routeId,
            String routeCode,
            String routeName,
            long territoryId,
            String territoryCode,
            String territoryName
    ) {}
}
