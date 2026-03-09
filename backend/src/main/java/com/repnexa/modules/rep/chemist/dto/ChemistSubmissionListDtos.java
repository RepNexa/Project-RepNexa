package com.repnexa.modules.rep.chemist.dto;

import java.time.LocalDate;

public final class ChemistSubmissionListDtos {
    private ChemistSubmissionListDtos() {}

    public record ChemistSubmissionRow(
            long id,
            long routeId,
            LocalDate visitDate
    ) {}
}
