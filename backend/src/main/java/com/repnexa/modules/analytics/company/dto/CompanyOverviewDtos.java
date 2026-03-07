package com.repnexa.modules.analytics.company.dto;

import java.time.LocalDate;
import java.util.List;

public final class CompanyOverviewDtos {
    private CompanyOverviewDtos() {}

    public enum Period {
        THIS_MONTH,
        LAST_MONTH,
        CUSTOM
    }

    public enum Grade {
        A, B, C
    }

    public record CompanyOverviewRequest(
            Period period,
            LocalDate dateFrom,
            LocalDate dateTo,
            List<Long> routeIds,
            Long fieldManagerId,
            Grade grade
    ) {}

    public record PeriodUsed(LocalDate dateFrom, LocalDate dateTo) {}

    public record CoverageMetric(Double value, Double deltaVsLastMonth) {}

    public record CoverageBar(String grade, Double value) {}

    public record ScopeInfo(List<Long> effectiveRouteIds) {}

    public record Flags(
            boolean noData,
            boolean gradeNotSupported,
            boolean targetAchievementNa,
            boolean repPerformanceNa,
            boolean productCoverageMatrixNa,
            boolean oosNa
    ) {}

    public record TargetAchievementRow(long repUserId, String repUsername, Double achievement) {}
    public record RepPerformanceRow(Long repUserId, String repUsername, Long visits) {}
    public record ProductCoverageCell(String code, String name, Double coverage) {}
    public record OosPoint(String key, Long count) {}

    // Spec-aligned datasets (additive; frontends can adopt incrementally)
    public record RepPerformanceDetailRow(
            long repUserId,
            String repUsername,
            String territory,
            long totalVisits,
            long uniqueDoctors,
            long aGradeVisits,
            long bGradeVisits,
            long cGradeVisits
    ) {}

    public record ProductCoverageByGradeRow(
            String code,
            String name,
            long allDoctors,
            long aDoctors,
            long bDoctors,
            long cDoctors
    ) {}

    public record CompanyOverviewResponse(
            PeriodUsed periodUsed,
            CoverageMetric coverageSelectedGrade,
            Long doctorsAtRisk,
            Long visits,
            Double avgDoctorVisits,
            List<CoverageBar> coverageByGrade,
            List<TargetAchievementRow> targetAchievementByRep,
            List<RepPerformanceRow> repPerformanceTable,
            List<ProductCoverageCell> productCoverageMatrix,
            List<OosPoint> oosByProduct,
            List<OosPoint> oosByRoute,
            List<OosPoint> oosByTerritory,
            List<RepPerformanceDetailRow> repPerformanceDetail,
            List<ProductCoverageByGradeRow> productCoverageByGrade,
            Flags flags,
            ScopeInfo scope
    ) {}
}