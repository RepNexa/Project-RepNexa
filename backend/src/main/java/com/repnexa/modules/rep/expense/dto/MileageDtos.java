package com.repnexa.modules.rep.expense.dto;

import java.time.LocalDate;

public final class MileageDtos {
    private MileageDtos() {}

    public record CreateMileageEntryRequest(
            Long repRouteAssignmentId,
            LocalDate entryDate,
            Double km
    ) {}

    public record CreatedResponse(Long id) {}
}
