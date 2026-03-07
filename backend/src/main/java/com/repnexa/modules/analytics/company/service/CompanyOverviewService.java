package com.repnexa.modules.analytics.company.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos;
import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.CompanyOverviewRequest;
import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.CompanyOverviewResponse;
import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.CoverageBar;
import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.CoverageMetric;
import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.Flags;
import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.Period;
import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.PeriodUsed;
import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.ScopeInfo;
import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.TargetAchievementRow;
import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos.RepPerformanceRow;
import com.repnexa.modules.analytics.company.repo.CompanyOverviewJdbcRepository;
import com.repnexa.modules.analytics.company.repo.CompanyOverviewJdbcRepository.VisitStats;
import com.repnexa.modules.assignments.repo.ScopeJdbcRepository;
import com.repnexa.modules.auth.repo.UsernameUserIdRepository;
import com.repnexa.modules.meta.service.MetaService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;

@Service
public class CompanyOverviewService {

    private final ScopeJdbcRepository scope;
    private final CompanyOverviewJdbcRepository repo;
    private final UsernameUserIdRepository users;
    private final MetaService meta;
    private final Clock clock;

    public CompanyOverviewService(
            ScopeJdbcRepository scope,
            CompanyOverviewJdbcRepository repo,
            UsernameUserIdRepository users,
            MetaService meta,
            Clock clock
    ) {
        this.scope = scope;
        this.repo = repo;
        this.users = users;
        this.meta = meta;
        this.clock = clock;
    }

    private static String normalizeGrade(CompanyOverviewDtos.Grade raw) {
        return raw == null ? null : raw.name(); // "A" | "B" | "C"
    }

    public CompanyOverviewResponse compute(CompanyOverviewRequest req, Authentication auth) {
        boolean isCm = hasRole(auth, "ROLE_CM");
        boolean isFm = hasRole(auth, "ROLE_FM");

        LocalDate today = LocalDate.now(clock);
        PeriodUsed used = resolvePeriod(req, today);

        // Allowed routes (server-side)
        List<Long> allowed;
        if (isCm) {
            if (req.fieldManagerId() != null) {
                allowed = scope.listAllowedRouteIdsForFm(req.fieldManagerId());
            } else {
                allowed = scope.listAllActiveRouteIdsForCm();
            }
        } else if (isFm) {
            long fmUserId = users.requireUserIdByUsername(auth.getName());
            allowed = scope.listAllowedRouteIdsForFm(fmUserId);
        } else {
            // Should never happen (security matcher limits to CM/FM), but keep safe.
            allowed = List.of();
        }

        // Effective routes = intersection(request.routeIds, allowed)
        List<Long> effective = intersect(req.routeIds(), allowed);

        // Targets (A/B/C monthly targets)
        // Expected: A=6, B=4, C=2 (centralized in MetaService)
        var targets = meta.gradeTargets();

        String selectedGrade = normalizeGrade(req.grade());

        if (effective.isEmpty()) {
            return emptyResponse(used, effective);
        }

        VisitStats curAll = repo.getVisitStats(effective, used.dateFrom(), used.dateTo());
        VisitStats curSelected = (selectedGrade != null)
                ? repo.getVisitStatsByGrade(effective, used.dateFrom(), used.dateTo(), selectedGrade)
                : curAll;

        // Per-grade stats (used for coverage bars)
        VisitStats curA = repo.getVisitStatsByGrade(effective, used.dateFrom(), used.dateTo(), "A");
        VisitStats curB = repo.getVisitStatsByGrade(effective, used.dateFrom(), used.dateTo(), "B");
        VisitStats curC = repo.getVisitStatsByGrade(effective, used.dateFrom(), used.dateTo(), "C");

        // Spec-aligned:
        // - Coverage% = coveredDoctors / totalDoctors
        // - Avg visits/doctor = visits / totalDoctors  (numeric like 3.6)
        Double avgDoctorVisits = safeRatio(curAll.visits(), curAll.totalDoctors());

        Double selectedCoverage = (selectedGrade != null)
                ? safeRatio(curSelected.coveredDoctors(), curSelected.totalDoctors())
                : safeRatio(curAll.coveredDoctors(), curAll.totalDoctors());

        CoverageMetric coverage = computeCoverageMetric(req.period(), effective, selectedGrade, used, today);

        long atRisk = repo.countDoctorsAtRisk14d(effective, used.dateTo());
        // avgDoctorVisits already computed against required visits above.

        // Coverage % by Grade (A/B/C)
        List<CoverageBar> bars = List.of(
                new CoverageBar("A", safeRatio(curA.coveredDoctors(), curA.totalDoctors())),
                new CoverageBar("B", safeRatio(curB.coveredDoctors(), curB.totalDoctors())),
                new CoverageBar("C", safeRatio(curC.coveredDoctors(), curC.totalDoctors()))
        );

        // Rep performance (simple: visits per rep)
        List<RepPerformanceRow> repPerf = repo.listRepVisitAgg(effective, used.dateFrom(), used.dateTo())
            .stream()
            .map(r -> new RepPerformanceRow(r.repUserId(), r.repUsername(), r.visits()))
            .toList();

        // Target achievement by rep (visits / required visits based on assigned routes + grade targets)
        int tA = targets.getOrDefault("A", 0);
        int tB = targets.getOrDefault("B", 0);
        int tC = targets.getOrDefault("C", 0);
        List<TargetAchievementRow> targetAch = repo
            .listTargetAchievementAgg(effective, used.dateFrom(), used.dateTo(), tA, tB, tC)
            .stream()
            .map(r -> new TargetAchievementRow(r.repUserId(), r.repUsername(), r.achievement()))
            .toList();

        // Product coverage matrix (top products promoted; coverage among doctors in scope)
        var productMatrix = repo.listProductCoverageMatrix(effective, used.dateFrom(), used.dateTo(), selectedGrade);

        // OOS charts
        var oosByProduct = repo.listOosByProduct(effective, used.dateFrom(), used.dateTo());
        var oosByRoute = repo.listOosByRoute(effective, used.dateFrom(), used.dateTo());
        var oosByTerritory = repo.listOosByTerritory(effective, used.dateFrom(), used.dateTo());

        // Spec-aligned table + matrix
        var repPerfDetail = repo.listRepPerformanceDetail(effective, used.dateFrom(), used.dateTo());
        var productByGrade = repo.listProductCoverageByGrade(effective, used.dateFrom(), used.dateTo());

        Flags flags = new Flags(
                curAll.totalDoctors() == 0,
                false,
                targetAch.isEmpty(),
                repPerfDetail.isEmpty(),
                productByGrade.isEmpty(),
                (oosByProduct.isEmpty() && oosByTerritory.isEmpty())
        );

        return new CompanyOverviewResponse(
                used,
                coverage,
                atRisk,
                curAll.visits(),
                avgDoctorVisits,
                bars,
                targetAch,
                repPerf,
                productMatrix,
                oosByProduct,
                oosByRoute,
                oosByTerritory,
                repPerfDetail,
                productByGrade,
                flags,
                new ScopeInfo(effective)
        );
    }

    CompanyOverviewResponse emptyResponse(PeriodUsed used, List<Long> effective) {
        Flags flags = new Flags(
                true,
                false,
                true,
                true,
                true,
                true
        );
        return new CompanyOverviewResponse(
                used,
                new CoverageMetric(null, null),
                0L,
                0L,
                null,
                List.of(
                        new CoverageBar("A", null),
                        new CoverageBar("B", null),
                        new CoverageBar("C", null)
                ),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                flags,
                new ScopeInfo(effective)
        );
    }

    private static long requiredVisits(long totalDoctors, int targetPerMonth) {
        if (totalDoctors <= 0 || targetPerMonth <= 0) return 0L;
        return totalDoctors * (long) targetPerMonth;
   }


    private CoverageMetric computeCoverageMetric(Period period, List<Long> effective, String selectedGrade, PeriodUsed used, LocalDate today) {
        Double value;
        if (selectedGrade != null) {
            VisitStats curSel = repo.getVisitStatsByGrade(effective, used.dateFrom(), used.dateTo(), selectedGrade);
            value = safeRatio(curSel.coveredDoctors(), curSel.totalDoctors());
        } else {
            VisitStats curAll = repo.getVisitStats(effective, used.dateFrom(), used.dateTo());
            value = safeRatio(curAll.coveredDoctors(), curAll.totalDoctors());
        }
        Double delta = null;

        if (period == Period.THIS_MONTH || period == Period.LAST_MONTH) {
            LocalDate prevFrom = used.dateFrom().minusMonths(1);
            LocalDate prevTo = used.dateTo().minusMonths(1);
            // Keep prevTo within "today" bounds only for THIS_MONTH; LAST_MONTH is historical.
            if (period == Period.THIS_MONTH && prevTo.isAfter(today.minusMonths(1))) {
                prevTo = today.minusMonths(1);
            }

            Double prevValue;
            if (selectedGrade != null) {
                VisitStats prevSel = repo.getVisitStatsByGrade(effective, prevFrom, prevTo, selectedGrade);
                prevValue = safeRatio(prevSel.coveredDoctors(), prevSel.totalDoctors());
            } else {
                VisitStats prevAll = repo.getVisitStats(effective, prevFrom, prevTo);
                prevValue = safeRatio(prevAll.coveredDoctors(), prevAll.totalDoctors());
            }
            delta = safeDelta(value, prevValue);
        }

        return new CoverageMetric(value, delta);
    }

    public static Double safeRatio(long numerator, long denominator) {
        if (denominator <= 0) return null;
        return numerator / (double) denominator;
    }

    public static Double safeDelta(Double current, Double previous) {
        if (current == null || previous == null) return null;
        return current - previous;
    }

    private PeriodUsed resolvePeriod(CompanyOverviewRequest req, LocalDate today) {
        if (req.period() == null) {
            throw new IllegalArgumentException("period is required");
        }
        return switch (req.period()) {
            case THIS_MONTH -> new PeriodUsed(today.withDayOfMonth(1), today);
            case LAST_MONTH -> {
                LocalDate from = today.minusMonths(1).withDayOfMonth(1);
                LocalDate to = today.withDayOfMonth(1).minusDays(1);
                yield new PeriodUsed(from, to);
            }
            case CUSTOM -> {
                if (req.dateFrom() == null || req.dateTo() == null) {
                    throw new IllegalArgumentException("dateFrom and dateTo are required for CUSTOM period");
                }
                if (req.dateFrom().isAfter(req.dateTo())) {
                    throw new IllegalArgumentException("dateFrom must be <= dateTo");
                }
                yield new PeriodUsed(req.dateFrom(), req.dateTo());
            }
        };
    }

    private List<Long> intersect(List<Long> requested, List<Long> allowed) {
        if (allowed == null || allowed.isEmpty()) return List.of();
        if (requested == null || requested.isEmpty()) return allowed;

        Set<Long> reqSet = new HashSet<>(requested);
        List<Long> out = new ArrayList<>();
        for (Long id : allowed) {
            if (id != null && reqSet.contains(id)) out.add(id);
        }
        return out;
    }

    private boolean hasRole(Authentication auth, String role) {
        for (GrantedAuthority ga : auth.getAuthorities()) {
            if (role.equals(ga.getAuthority())) return true;
        }
        return false;
    }
}