package com.repnexa.modules.rep.todo.service;

import com.repnexa.modules.assignments.service.ScopeEnforcer;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.meta.service.MetaService;
import com.repnexa.modules.rep.todo.dto.RepTodoDtos;
import com.repnexa.modules.rep.todo.repo.RepTodoJdbcRepository;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

@Service
public class RepTodoService {

    private final ScopeEnforcer scope;
    private final RepTodoJdbcRepository repo;
    private final MetaService meta;
    private final Clock clock;

    public RepTodoService(ScopeEnforcer scope,
                          RepTodoJdbcRepository repo,
                          MetaService meta,
                          Clock clock) {
        this.scope = scope;
        this.repo = repo;
        this.meta = meta;
        this.clock = clock;
    }

    public static LocalDate sprintWindowStart(LocalDate today) {
        return today.minusDays(13);
    }

    public static LocalDate sprintWindowEnd(LocalDate today) {
        return today;
    }

    public RepTodoDtos.TodoResponse getTodo(RepnexaUserDetails actor, long routeId, YearMonth month) {
        scope.assertMrHasRoute(actor, routeId);

        LocalDate today = LocalDate.now(clock);
        LocalDate windowStart = sprintWindowStart(today);
        LocalDate windowEnd = sprintWindowEnd(today);

        LocalDate monthStart = month.atDay(1);
        LocalDate monthEndExclusive = month.plusMonths(1).atDay(1);

        Map<String, Integer> targets = meta.gradeTargets();

        List<RepTodoJdbcRepository.DoctorAgg> aggs = repo.fetchDoctorAggs(
                actor.id(),
                routeId,
                monthStart,
                monthEndExclusive,
                windowStart,
                windowEnd
        );

        List<RepTodoDtos.Row> rows = aggs.stream().map(a -> {
            String grade = a.grade();
            int planned = targets.getOrDefault(grade, 0);
            int visits = a.visitsThisMonth();
            int remaining = Math.max(planned - visits, 0);
            boolean atRisk = a.sprintVisits() == 0;

            return new RepTodoDtos.Row(
                    a.doctorId(),
                    a.doctorName(),
                    grade,
                    planned,
                    visits,
                    remaining,
                    a.lastVisitDate(),
                    atRisk,
                    windowStart,
                    windowEnd
            );
        }).toList();

        return new RepTodoDtos.TodoResponse(routeId, month.toString(), rows);
    }
}
