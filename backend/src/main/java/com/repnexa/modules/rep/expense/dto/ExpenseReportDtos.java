package com.repnexa.modules.rep.expense.dto;

public final class ExpenseReportDtos {
    private ExpenseReportDtos() {}

    /**
     * Minimal list DTO for prototype parity.
     * For now the endpoint returns an empty list, so fields are placeholders.
     */
    public record ReportListItem(Long id, String submittedAt) {}
}