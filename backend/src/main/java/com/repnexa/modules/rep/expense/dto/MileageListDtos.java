package com.repnexa.modules.rep.expense.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public final class MileageListDtos {
    private MileageListDtos() {}

    public record MileageEntryRow(
            long id,
            long routeId,
            LocalDate entryDate,
            BigDecimal km
    ) {}
}
