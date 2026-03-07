package com.repnexa.modules.analytics.chemist;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.analytics.company.common.AnalyticsScopeService;
import java.util.ArrayList;
import java.sql.Types;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/analytics")
public class ChemistAnalyticsController {

  private final AnalyticsScopeService scopeService;
  private final NamedParameterJdbcTemplate jdbc;
  private final Clock clock;

  public ChemistAnalyticsController(AnalyticsScopeService scopeService, NamedParameterJdbcTemplate jdbc, Clock clock) {
    this.scopeService = scopeService;
    this.jdbc = jdbc;
    this.clock = clock;
  }

  @PostMapping("/chemist-details")
  public ChemistDetailsResponse chemistDetails(@RequestBody ChemistDetailsRequest req, Authentication auth) {
    List<Long> effectiveRoutes = scopeService.resolveEffectiveRouteIds(auth, req.routeIds(), req.fieldManagerId());
    DateRange range = DateRange.from(req.period(), req.dateFrom(), req.dateTo(), clock);

    if (effectiveRoutes == null || effectiveRoutes.isEmpty()) {
      return new ChemistDetailsResponse(
          new PeriodUsed(range.dateFrom(), range.dateTo()),
          0,
          null,
          0L,
          List.of(),
          List.of(),
          new Flags(false)
      );
    }

    ChemistInfo chemist = null;
    if (req.chemistId() != null) {
      chemist = jdbc.query("""
          select c.id, c.name, c.route_id
          from chemists c
          where c.id = :id and c.deleted_at is null
      """, new MapSqlParameterSource().addValue("id", req.chemistId()), rs -> rs.next()
          ? new ChemistInfo(rs.getLong("id"), rs.getString("name"), rs.getLong("route_id"))
          : null
      );
      if (chemist == null) {
        throw new ApiException(404, "CHEMIST_NOT_FOUND", "Chemist not found");
      }
      if (!effectiveRoutes.contains(chemist.routeId())) {
        throw new ApiException(403, "SCOPE_FORBIDDEN", "Chemist out of scope");
      }
    }

    long visitCount = 0;
    if (req.chemistId() != null) {
      visitCount = jdbc.queryForObject("""
          select count(*)::bigint
          from chemist_visits v
          where v.chemist_id = :cid
            and v.route_id in (:routeIds)
            and v.visit_date between :dateFrom and :dateTo
      """, new MapSqlParameterSource()
         .addValue("cid", req.chemistId())
          .addValue("routeIds", effectiveRoutes)
          .addValue("dateFrom", range.dateFrom())
          .addValue("dateTo", range.dateTo()),
      Long.class);
    }
    
    MapSqlParameterSource stockParams = new MapSqlParameterSource()
        .addValue("routeIds", effectiveRoutes)
        .addValue("dateFrom", range.dateFrom())
        .addValue("dateTo", range.dateTo())
        .addValue("cid", req.chemistId(), Types.BIGINT); // may be null

    var oosByProduct = jdbc.query("""
        select p.code as key, count(*)::bigint as count
        from chemist_stock_flags f
        join chemist_visits v on v.id = f.visit_id
        join products p on p.id = f.product_id and p.deleted_at is null
        where v.route_id in (:routeIds)
          and v.visit_date between :dateFrom and :dateTo
          and (:cid is null or v.chemist_id = :cid)
          and f.status = 'OOS'
        group by p.code
        order by count desc, p.code asc
        limit 20
    """, stockParams,
        (rs, i) -> new Point(rs.getString("key"), rs.getLong("count"))
    );

    var lowByProduct = jdbc.query("""
        select p.code as key, count(*)::bigint as count
        from chemist_stock_flags f
        join chemist_visits v on v.id = f.visit_id
        join products p on p.id = f.product_id and p.deleted_at is null
        where v.route_id in (:routeIds)
          and v.visit_date between :dateFrom and :dateTo
          and (:cid is null or v.chemist_id = :cid)
          and f.status = 'LOW'
        group by p.code
        order by count desc, p.code asc
        limit 20
    """, stockParams,
        (rs, i) -> new Point(rs.getString("key"), rs.getLong("count"))
    );

    return new ChemistDetailsResponse(
        new PeriodUsed(range.dateFrom(), range.dateTo()),
        effectiveRoutes.size(),
        chemist,
        visitCount,
        oosByProduct,
        lowByProduct,
        new Flags(false)
    );
  }

  public enum Period { THIS_MONTH, LAST_MONTH, CUSTOM }
  public record ChemistDetailsRequest(Period period, LocalDate dateFrom, LocalDate dateTo, List<Long> routeIds, Long fieldManagerId, Long chemistId) {}
  public record PeriodUsed(LocalDate dateFrom, LocalDate dateTo) {}
  public record ChemistInfo(long id, String name, long routeId) {}
  public record Point(String key, long count) {}
  public record Flags(boolean stockFlagsNotSupported) {}
  public record ChemistDetailsResponse(
      PeriodUsed periodUsed,
      int effectiveRouteCount,
      ChemistInfo chemist,
      long visitCount,
      List<Point> oosByProduct,
      List<Point> lowByProduct,
      Flags flags
  ) {}

  @GetMapping("/chemists/{id}/visit-log")
  public PagedResponse<ChemistVisitLogItem> chemistVisitLog(
      @PathVariable("id") long chemistId,
      @RequestParam(name = "page", required = false) Integer page,
      @RequestParam(name = "size", required = false) Integer size,
      @RequestParam(name = "dateFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
      @RequestParam(name = "dateTo", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
      @RequestParam(name = "routeIds", required = false) List<Long> routeIds,
      @RequestParam(name = "fieldManagerId", required = false) Long fieldManagerId,
      Authentication auth
  ) {
    int p = (page == null) ? 0 : Math.max(0, page);
    int s = (size == null) ? 50 : size;
    if (s < 1) s = 1;
    if (s > 50) s = 50;

    LocalDate today = LocalDate.now(clock);
    LocalDate df = (dateFrom != null) ? dateFrom : YearMonth.from(today).atDay(1);
    LocalDate dt = (dateTo != null) ? dateTo : today;

    List<Long> effectiveRoutes = scopeService.resolveEffectiveRouteIds(auth, routeIds, fieldManagerId);
    if (effectiveRoutes == null || effectiveRoutes.isEmpty()) {
      return new PagedResponse<>(p, s, 0L, 0, List.of());
    }

    ChemistInfo chemist = jdbc.query("""
        select c.id, c.name, c.route_id
        from chemists c
        where c.id = :id and c.deleted_at is null
    """, new MapSqlParameterSource().addValue("id", chemistId), rs -> rs.next()
        ? new ChemistInfo(rs.getLong("id"), rs.getString("name"), rs.getLong("route_id"))
        : null
    );
    if (chemist == null) throw new ApiException(404, "CHEMIST_NOT_FOUND", "Chemist not found");
    if (!effectiveRoutes.contains(chemist.routeId())) throw new ApiException(403, "SCOPE_FORBIDDEN", "Chemist out of scope");

    var base = new java.util.HashMap<String, Object>();
    base.put("cid", chemistId);
    base.put("routeIds", effectiveRoutes);
    base.put("dateFrom", df);
    base.put("dateTo", dt);

    Long total = jdbc.queryForObject("""
        select count(*)::bigint
        from chemist_visits v
        where v.chemist_id = :cid
          and v.route_id in (:routeIds)
          and v.visit_date between :dateFrom and :dateTo
    """, base, Long.class);
    long totalElements = (total == null) ? 0L : total;
    int totalPages = totalElements == 0 ? 0 : (int) ((totalElements + s - 1) / s);

    var params = new java.util.HashMap<String, Object>(base);
    params.put("limit", s);
    params.put("offset", (long) p * (long) s);

    List<ChemistVisitLogItem> items = jdbc.query("""
        select
          v.id as visit_id,
          v.visit_date as visit_date,
          r.id as route_id,
          r.code as route_code,
          r.name as route_name,
          u.id as rep_user_id,
          u.username as rep_username,
          coalesce(
            array_agg(distinct p.code order by p.code)
              filter (where f.status = 'OOS' and p.code is not null),
            '{}'::text[]
          ) as oos_product_codes,
          coalesce(
            array_agg(distinct p.code order by p.code)
              filter (where f.status = 'LOW' and p.code is not null),
            '{}'::text[]
          ) as low_product_codes
        from chemist_visits v
        join routes r on r.id = v.route_id and r.deleted_at is null
        join users u on u.id = v.rep_user_id
        left join chemist_stock_flags f on f.visit_id = v.id
        left join products p on p.id = f.product_id and p.deleted_at is null
        where v.chemist_id = :cid
          and v.route_id in (:routeIds)
          and v.visit_date between :dateFrom and :dateTo
        group by v.id, v.visit_date, r.id, r.code, r.name, u.id, u.username
        order by v.visit_date desc, v.id desc
        limit :limit offset :offset
    """, params, (rs, i) -> {
      List<String> oos = new ArrayList<>();
      List<String> low = new ArrayList<>();
      var a1 = rs.getArray("oos_product_codes");
      if (a1 != null) {
        Object v = a1.getArray();
        if (v instanceof String[] ss) oos = java.util.Arrays.asList(ss);
      }
      var a2 = rs.getArray("low_product_codes");
      if (a2 != null) {
        Object v = a2.getArray();
        if (v instanceof String[] ss) low = java.util.Arrays.asList(ss);
      }
      return new ChemistVisitLogItem(
          rs.getLong("visit_id"),
          rs.getObject("visit_date", LocalDate.class),
          rs.getLong("route_id"),
          rs.getString("route_code"),
          rs.getString("route_name"),
          rs.getLong("rep_user_id"),
          rs.getString("rep_username"),
          oos,
          low
      );
    });

    return new PagedResponse<>(p, s, totalElements, totalPages, items);
  }

  @GetMapping("/chemists/{id}/oos-history")
  public List<ChemistOosHistoryItem> chemistOosHistory(
      @PathVariable("id") long chemistId,
      @RequestParam(name = "dateFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
      @RequestParam(name = "dateTo", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
      @RequestParam(name = "routeIds", required = false) List<Long> routeIds,
      @RequestParam(name = "fieldManagerId", required = false) Long fieldManagerId,
      @RequestParam(name = "limit", required = false) Integer limit,
      Authentication auth
  ) {
    int lim = (limit == null) ? 80 : Math.max(1, Math.min(200, limit));

    LocalDate today = LocalDate.now(clock);
    LocalDate df = (dateFrom != null) ? dateFrom : YearMonth.from(today).atDay(1);
    LocalDate dt = (dateTo != null) ? dateTo : today;

    List<Long> effectiveRoutes = scopeService.resolveEffectiveRouteIds(auth, routeIds, fieldManagerId);
    if (effectiveRoutes == null || effectiveRoutes.isEmpty()) return List.of();

    ChemistInfo chemist = jdbc.query("""
        select c.id, c.name, c.route_id
        from chemists c
        where c.id = :id and c.deleted_at is null
    """, new MapSqlParameterSource().addValue("id", chemistId), rs -> rs.next()
        ? new ChemistInfo(rs.getLong("id"), rs.getString("name"), rs.getLong("route_id"))
        : null
    );
    if (chemist == null) throw new ApiException(404, "CHEMIST_NOT_FOUND", "Chemist not found");
    if (!effectiveRoutes.contains(chemist.routeId())) throw new ApiException(403, "SCOPE_FORBIDDEN", "Chemist out of scope");

    var params = new java.util.HashMap<String, Object>();
    params.put("cid", chemistId);
    params.put("routeIds", effectiveRoutes);
    params.put("dateFrom", df);
    params.put("dateTo", dt);
    params.put("limit", lim);

    return jdbc.query("""
        select
          v.visit_date as event_date,
          p.code as product_code,
          f.status as status,
          u.id as rep_user_id,
          u.username as rep_username,
          r.id as route_id,
          r.name as route_name
        from chemist_stock_flags f
        join chemist_visits v on v.id = f.visit_id
        join products p on p.id = f.product_id and p.deleted_at is null
        join users u on u.id = v.rep_user_id
        join routes r on r.id = v.route_id and r.deleted_at is null
        where v.chemist_id = :cid
          and v.route_id in (:routeIds)
          and v.visit_date between :dateFrom and :dateTo
        order by v.visit_date desc, f.id desc
        limit :limit
    """, params, (rs, i) -> new ChemistOosHistoryItem(
        rs.getObject("event_date", LocalDate.class),
        rs.getString("product_code"),
        rs.getString("status"),
        rs.getLong("rep_user_id"),
        rs.getString("rep_username"),
        rs.getLong("route_id"),
        rs.getString("route_name")
    ));
  }

  @GetMapping("/chemists/{id}/visits-over-time")
  public List<PointDate> chemistVisitsOverTime(
      @PathVariable("id") long chemistId,
      @RequestParam(name = "dateFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
      @RequestParam(name = "dateTo", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
      @RequestParam(name = "routeIds", required = false) List<Long> routeIds,
      @RequestParam(name = "fieldManagerId", required = false) Long fieldManagerId,
      Authentication auth
  ) {
    LocalDate today = LocalDate.now(clock);
    LocalDate df = (dateFrom != null) ? dateFrom : YearMonth.from(today).atDay(1);
    LocalDate dt = (dateTo != null) ? dateTo : today;

    List<Long> effectiveRoutes = scopeService.resolveEffectiveRouteIds(auth, routeIds, fieldManagerId);
    if (effectiveRoutes == null || effectiveRoutes.isEmpty()) return List.of();

    ChemistInfo chemist = jdbc.query("""
        select c.id, c.name, c.route_id
        from chemists c
        where c.id = :id and c.deleted_at is null
    """, new MapSqlParameterSource().addValue("id", chemistId), rs -> rs.next()
        ? new ChemistInfo(rs.getLong("id"), rs.getString("name"), rs.getLong("route_id"))
        : null
    );
    if (chemist == null) throw new ApiException(404, "CHEMIST_NOT_FOUND", "Chemist not found");
    if (!effectiveRoutes.contains(chemist.routeId())) throw new ApiException(403, "SCOPE_FORBIDDEN", "Chemist out of scope");

    var params = new java.util.HashMap<String, Object>();
    params.put("cid", chemistId);
    params.put("routeIds", effectiveRoutes);
    params.put("dateFrom", df);
    params.put("dateTo", dt);

    return jdbc.query("""
        select date_trunc('week', v.visit_date)::date as x, count(*)::bigint as y
        from chemist_visits v
        where v.chemist_id = :cid
          and v.route_id in (:routeIds)
          and v.visit_date between :dateFrom and :dateTo
        group by 1
        order by 1 asc
    """, params, (rs, i) -> new PointDate(
        rs.getObject("x", LocalDate.class),
        rs.getLong("y")
    ));
  }

  public record ChemistVisitLogItem(
      long visitId,
      LocalDate visitDate,
      long routeId,
      String routeCode,
      String routeName,
      long repUserId,
      String repUsername,
      List<String> oosProductCodes,
      List<String> lowProductCodes
  ) {}

  public record ChemistOosHistoryItem(
      LocalDate date,
      String productCode,
      String status,
      long repUserId,
      String repUsername,
      long routeId,
      String routeName
  ) {}

  public record PagedResponse<T>(
      int page,
      int size,
      long totalElements,
      int totalPages,
      List<T> items
  ) {}

  public record PointDate(LocalDate x, long y) {}


  record DateRange(LocalDate dateFrom, LocalDate dateTo) {
    static DateRange from(Period period, LocalDate dateFrom, LocalDate dateTo, Clock clock) {
      LocalDate today = LocalDate.now(clock);
      Period p = period == null ? Period.THIS_MONTH : period;
      return switch (p) {
        case THIS_MONTH -> {
          YearMonth ym = YearMonth.from(today);
          yield new DateRange(ym.atDay(1), today);
       }
        case LAST_MONTH -> {
          YearMonth ym = YearMonth.from(today).minusMonths(1);
          yield new DateRange(ym.atDay(1), ym.atEndOfMonth());
        }
        case CUSTOM -> {
          LocalDate df = (dateFrom != null) ? dateFrom : YearMonth.from(today).atDay(1);
          LocalDate dt = (dateTo != null) ? dateTo : today;
          yield new DateRange(df, dt);
        }
      };
    }
  }
}