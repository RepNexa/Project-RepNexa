package com.repnexa.modules.analytics.rep;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.analytics.company.common.AnalyticsScopeService;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/analytics")
public class RepAnalyticsController {

  private final AnalyticsScopeService scopeService;
  private final NamedParameterJdbcTemplate jdbc;
  private final Clock clock;

  public RepAnalyticsController(AnalyticsScopeService scopeService, NamedParameterJdbcTemplate jdbc, Clock clock) {
    this.scopeService = scopeService;
    this.jdbc = jdbc;
    this.clock = clock;
  }

  @PostMapping("/rep-details")
  public RepDetailsResponse repDetails(@RequestBody RepDetailsRequest req, Authentication auth) {
    List<Long> routeIds = scopeService.resolveEffectiveRouteIds(auth, req.routeIds(), req.fieldManagerId());
    // DateRange range = DateRange.from(req.period(), clock);
    DateRange range = DateRange.from(req.period(), req.dateFrom(), req.dateTo(), clock);

    if (req.repUserId() != null) {
      Integer cnt = jdbc.queryForObject(
          "select count(*) from users u where u.id = :id",
          Map.of("id", req.repUserId()),
          Integer.class
      );
      if (cnt == null || cnt == 0) {
        throw new ApiException(404, "REP_NOT_FOUND", "Rep not found");
      }
    }

    var params = new java.util.HashMap<String, Object>();
    params.put("routeIds", routeIds);
    params.put("dateFrom", range.dateFrom());
    params.put("dateTo", range.dateTo());
    if (req.repUserId() != null) params.put("repUserId", req.repUserId());

    String sql =
        """
        select
          c.rep_user_id,
          u.username as rep_name,
          count(c.id) as visit_count,
          count(distinct c.doctor_id) as unique_doctors,
          max(c.call_date) as last_visit_date
        from doctor_calls c
        join users u on u.id = c.rep_user_id
        where c.route_id in (:routeIds)
          and c.call_date >= :dateFrom
          and c.call_date <= :dateTo
        """ + (req.repUserId() != null ? " and c.rep_user_id = :repUserId " : "") +
        """
        group by c.rep_user_id, u.username
        order by visit_count desc, rep_name asc
        limit 200
        """;

    List<RepRow> rows = jdbc.query(sql, params, (rs, i) -> new RepRow(
        rs.getLong("rep_user_id"),
        rs.getString("rep_name"),
        rs.getLong("visit_count"),
        rs.getLong("unique_doctors"),
        rs.getObject("last_visit_date", LocalDate.class)
    ));

    return new RepDetailsResponse(rows, new Flags(false));
  }

  @GetMapping("/reps/{id}/visit-log")
  public PagedResponse<RepVisitLogItem> repVisitLog(
      @PathVariable("id") long repUserId,
      @RequestParam(name = "page", required = false) Integer page,
      @RequestParam(name = "size", required = false) Integer size,
      @RequestParam(name = "dateFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
      @RequestParam(name = "dateTo", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
      @RequestParam(name = "routeIds", required = false) List<Long> routeIds,
      @RequestParam(name = "fieldManagerId", required = false) Long fieldManagerId,
      Authentication auth
  ) {
    // sanitize paging (avoid VALIDATION_ERROR for harmless client values)
    int p = (page == null) ? 0 : Math.max(0, page);
    int s = (size == null) ? 50 : size;
    if (s < 1) s = 1;
    if (s > 50) s = 50;

    // default date window = THIS_MONTH if not provided
    LocalDate today = LocalDate.now(clock);
    LocalDate df = (dateFrom != null) ? dateFrom : YearMonth.from(today).atDay(1);
    LocalDate dt = (dateTo != null) ? dateTo : today;

    List<Long> effectiveRoutes = scopeService.resolveEffectiveRouteIds(auth, routeIds, fieldManagerId);
    if (effectiveRoutes == null || effectiveRoutes.isEmpty()) {
      return new PagedResponse<>(p, s, 0L, 0, List.of());
    }

    Integer exists = jdbc.queryForObject(
        "select count(*) from users u where u.id = :id",
        Map.of("id", repUserId),
        Integer.class
    );
    if (exists == null || exists == 0) {
      throw new ApiException(404, "REP_NOT_FOUND", "Rep not found");
    }

    var baseParams = new java.util.HashMap<String, Object>();
    baseParams.put("repId", repUserId);
    baseParams.put("routeIds", effectiveRoutes);
    baseParams.put("dateFrom", df);
    baseParams.put("dateTo", dt);

    Long total = jdbc.queryForObject(
        """
        select count(*)::bigint
        from doctor_calls c
        where c.rep_user_id = :repId
          and c.route_id in (:routeIds)
          and c.call_date between :dateFrom and :dateTo
        """,
        baseParams,
        Long.class
    );
    long totalElements = (total == null) ? 0L : total;
    int totalPages = totalElements == 0 ? 0 : (int) ((totalElements + s - 1) / s);

    var params = new java.util.HashMap<String, Object>(baseParams);
    params.put("limit", s);
    params.put("offset", (long) p * (long) s);

    List<RepVisitLogItem> items = jdbc.query(
        """
        select
          c.id as call_id,
          c.call_date as call_date,
          r.id as route_id,
          r.code as route_code,
          r.name as route_name,
          d.id as doctor_id,
          d.name as doctor_name,
          u.username as rep_username,
          coalesce(array_remove(array_agg(distinct p.code order by p.code), null), '{}'::text[]) as product_codes
        from doctor_calls c
        join routes r on r.id = c.route_id and r.deleted_at is null
        join users u on u.id = c.rep_user_id
        join doctors d on d.id = c.doctor_id and d.deleted_at is null
        left join doctor_call_products dcp on dcp.doctor_call_id = c.id
        left join products p on p.id = dcp.product_id and p.deleted_at is null
        where c.rep_user_id = :repId
          and c.route_id in (:routeIds)
          and c.call_date between :dateFrom and :dateTo
        group by c.id, c.call_date, r.id, r.code, r.name, d.id, d.name, u.username
        order by c.call_date desc, c.id desc
        limit :limit offset :offset
        """,
        params,
        (rs, i) -> {
          List<String> pcs = new ArrayList<>();
          var arr = rs.getArray("product_codes");
          if (arr != null) {
            Object v = arr.getArray();
            if (v instanceof String[] ss) pcs = java.util.Arrays.asList(ss);
          }
          return new RepVisitLogItem(
              rs.getLong("call_id"),
              rs.getObject("call_date", LocalDate.class),
              rs.getLong("route_id"),
              rs.getString("route_code"),
              rs.getString("route_name"),
              rs.getLong("doctor_id"),
              rs.getString("doctor_name"),
              repUserId,
              rs.getString("rep_username"),
              pcs
          );
        }
    );

    return new PagedResponse<>(p, s, totalElements, totalPages, items);
  }

  // public enum Period { THIS_MONTH, LAST_MONTH }
  public enum Period { THIS_MONTH, LAST_MONTH, CUSTOM }

  public record RepDetailsRequest(
      Period period,
      LocalDate dateFrom,
      LocalDate dateTo,
      List<Long> routeIds,
      Long fieldManagerId,
      Long repUserId
  ) {}

  // public record RepDetailsRequest(Period period, List<Long> routeIds, Long fieldManagerId, Long repUserId) {}
  public record Flags(boolean placeholder) {}
  public record RepRow(long repUserId, String repName, long visitCount, long uniqueDoctors, LocalDate lastVisitDate) {}
  public record RepDetailsResponse(List<RepRow> rows, Flags flags) {}

  public record RepVisitLogItem(
      long callId,
      LocalDate callDate,
      long routeId,
      String routeCode,
      String routeName,
      long doctorId,
      String doctorName,
      long repUserId,
      String repUsername,
      List<String> productCodes
  ) {}

  public record PagedResponse<T>(
      int page,
      int size,
      long totalElements,
      int totalPages,
      List<T> items
  ) {}

  record DateRange(LocalDate dateFrom, LocalDate dateTo) {
    static DateRange from(
        Period period,
        LocalDate dateFrom,
        LocalDate dateTo,
        Clock clock
    ) {
      LocalDate today = LocalDate.now(clock);
      Period p = period == null ? Period.THIS_MONTH : period;

      if (p == Period.CUSTOM) {
        if (dateFrom != null && dateTo != null) {
          return normalize(dateFrom, dateTo);
        }
        p = Period.THIS_MONTH;
      }

      return switch (p) {
        case THIS_MONTH -> {
          YearMonth ym = YearMonth.from(today);
          yield new DateRange(ym.atDay(1), today);
        }
        case LAST_MONTH -> {
          YearMonth ym = YearMonth.from(today).minusMonths(1);
          yield new DateRange(ym.atDay(1), ym.atEndOfMonth());
        }
        case CUSTOM -> normalize(dateFrom, dateTo);
      };
    }

    private static DateRange normalize(LocalDate from, LocalDate to) {
      if (from == null || to == null) {
        throw new ApiException(400, "VALIDATION_ERROR", "dateFrom and dateTo are required for CUSTOM period");
      }
      if (to.isBefore(from)) {
        return new DateRange(to, from);
      }
      return new DateRange(from, to);
    }
  }
}
