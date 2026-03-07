package com.repnexa.modules.analytics.doctor;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.analytics.company.common.AnalyticsScopeService;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DoctorAnalyticsService {

  private final AnalyticsScopeService scopeService;
  private final DoctorAnalyticsJdbcRepository repo;
  private final Clock clock;

  public DoctorAnalyticsService(AnalyticsScopeService scopeService, DoctorAnalyticsJdbcRepository repo, Clock clock) {
    this.scopeService = scopeService;
    this.repo = repo;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public DoctorAnalyticsController.DoctorDetailsResponse doctorDetails(Authentication auth, DoctorAnalyticsController.DoctorDetailsRequest req) {
    List<Long> routeIds = scopeService.resolveEffectiveRouteIds(auth, req.routeIds(), req.fieldManagerId());
    DateRange range = DateRange.from(req.period(), req.dateFrom(), req.dateTo(), clock);

    String grade = req.grade();
    if (grade != null) {
      grade = grade.trim().toUpperCase();
      if (!grade.equals("A") && !grade.equals("B") && !grade.equals("C")) {
        throw new ApiException(400, "VALIDATION_ERROR", "grade must be A, B, or C");
      }
    }

    if (req.doctorId() != null && !repo.doctorExists(req.doctorId())) {
      throw new ApiException(404, "DOCTOR_NOT_FOUND", "Doctor not found");
    }

    var rows = repo.doctorDetails(routeIds, range.dateFrom(), range.dateTo(), req.doctorId(), grade);
    return new DoctorAnalyticsController.DoctorDetailsResponse(
        rows,
        new DoctorAnalyticsController.Flags(false)
    );
  }

  @Transactional(readOnly = true)
  public DoctorAnalyticsController.PagedResponse<DoctorAnalyticsController.DoctorVisitLogItem> doctorVisitLog(
      Authentication auth,
      long doctorId,
      Long fieldManagerId,
      Integer page,
      Integer size,
      LocalDate dateFrom,
      LocalDate dateTo
  ) {
    if (!repo.doctorExists(doctorId)) {
      throw new ApiException(404, "DOCTOR_NOT_FOUND", "Doctor not found");
    }

    int p = page == null ? 0 : page;
    int s = size == null ? 20 : size;
    if (p < 0 || s <= 0 || s > 200) {
      throw new ApiException(400, "VALIDATION_ERROR", "Invalid paging parameters");
    }

    LocalDate today = LocalDate.now(clock);
    LocalDate df = dateFrom != null ? dateFrom : today.minusDays(30);
    LocalDate dt = dateTo != null ? dateTo : today;
    if (df.isAfter(dt)) {
      throw new ApiException(400, "VALIDATION_ERROR", "dateFrom must be <= dateTo");
    }

    List<Long> routeIds = scopeService.resolveEffectiveRouteIds(auth, null, fieldManagerId);
    if (!repo.doctorHasRouteInScope(doctorId, routeIds)) {
      // Policy choice for Milestone 7: out-of-scope entity returns 403 SCOPE_FORBIDDEN (see implementation log).
      throw new ApiException(403, "SCOPE_FORBIDDEN", "Doctor out of scope");
    }

    long total = repo.countDoctorVisitLog(doctorId, routeIds, df, dt);
    int offset = p * s;
    var items = repo.fetchDoctorVisitLog(doctorId, routeIds, df, dt, s, offset);
    int totalPages = (int) Math.ceil(total / (double) s);

    return new DoctorAnalyticsController.PagedResponse<>(p, s, total, totalPages, items);
  }

  record DateRange(LocalDate dateFrom, LocalDate dateTo) {
    static DateRange from(
        DoctorAnalyticsController.Period period,
        LocalDate dateFrom,
        LocalDate dateTo,
        Clock clock
    ) {
      LocalDate today = LocalDate.now(clock);
      DoctorAnalyticsController.Period p =
          period == null ? DoctorAnalyticsController.Period.THIS_MONTH : period;

      if (p == DoctorAnalyticsController.Period.CUSTOM) {
        if (dateFrom != null && dateTo != null) {
          return normalize(dateFrom, dateTo);
        }
        p = DoctorAnalyticsController.Period.THIS_MONTH;
      }

      return switch (p) {
        case THIS_MONTH -> new DateRange(today.withDayOfMonth(1), today);
        case LAST_MONTH -> {
          LocalDate firstOfThisMonth = today.withDayOfMonth(1);
          yield new DateRange(firstOfThisMonth.minusMonths(1), firstOfThisMonth.minusDays(1));
        }
        case CUSTOM -> normalize(dateFrom, dateTo);
      };
    }
    private static DateRange normalize(LocalDate from, LocalDate to) {
      if (from == null || to == null) {
        throw new IllegalArgumentException("CUSTOM period requires dateFrom and dateTo");
      }
      if (to.isBefore(from)) {
        return new DateRange(to, from);
      }
      return new DateRange(from, to);
    }
  }
}