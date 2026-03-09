package com.repnexa.modules.rep.chemist.dto;

public final class ChemistReportDtos {
    private ChemistReportDtos() {}

    /**
     * Minimal list DTO for prototype parity.
     * For now the endpoint returns an empty list, so fields are placeholders.
     */
    public record ReportListItem(Long id, String submittedAt) {}
}