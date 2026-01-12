package com.repnexa.modules.rep.chemist.dto;

import java.time.LocalDate;
import java.util.List;

public final class ChemistSubmissionDtos {
    private ChemistSubmissionDtos() {}

    public record CreateChemistSubmissionRequest(
            Long repRouteAssignmentId,
            LocalDate visitDate,
            List<ChemistVisitInput> visits
    ) {}

    public record ChemistVisitInput(
            Long chemistId,
            List<StockFlagInput> stockFlags
    ) {}

    public record StockFlagInput(
            Long productId,
            String status // OOS | LOW
    ) {}

    public record CreatedResponse(Long id) {}
}
