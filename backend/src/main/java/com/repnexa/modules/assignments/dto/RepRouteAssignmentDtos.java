package com.repnexa.modules.assignments.dto;

import java.time.LocalDate;

public final class RepRouteAssignmentDtos {
    private RepRouteAssignmentDtos() {}

    public record CreateRepRouteAssignmentRequest(
            String repUsername,
            Long routeId,
            LocalDate startDate,
            LocalDate endDate
    ) {}

    public record PatchRepRouteAssignmentRequest(
            LocalDate endDate,
            Boolean enabled
    ) {}

    public record RepRouteAssignmentResponse(
            Long id,
            Long repUserId,
            String repUsername,
            Long routeId,
            LocalDate startDate,
            LocalDate endDate,
            boolean enabled
    ) {}
}
