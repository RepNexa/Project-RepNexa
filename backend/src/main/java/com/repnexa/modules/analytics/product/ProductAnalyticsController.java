package com.repnexa.modules.analytics.product;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.analytics.company.common.AnalyticsScopeService;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/analytics")
public class ProductAnalyticsController {

  private final AnalyticsScopeService scopeService;
  private final NamedParameterJdbcTemplate jdbc;
  private final Clock clock;

  public ProductAnalyticsController(AnalyticsScopeService scopeService, NamedParameterJdbcTemplate jdbc, Clock clock) {
    this.scopeService = scopeService;
    this.jdbc = jdbc;
    this.clock = clock;
  }

  @PostMapping("/product-details")
  public ProductDetailsResponse productDetails(@RequestBody ProductDetailsRequest req, Authentication auth) {
    List<Long> effectiveRoutes = scopeService.resolveEffectiveRouteIds(auth, req.routeIds(), req.fieldManagerId());
    DateRange range = DateRange.from(req.period(), req.dateFrom(), req.dateTo(), clock);

    if (req.productId() == null) {
      return new ProductDetailsResponse(
          new PeriodUsed(range.dateFrom(), range.dateTo()),
          effectiveRoutes.size(),
          null,        // product not selected yet
          0L,
          0L,
          0L,
          0L,
          List.of(),
          null,
          new Flags(false)
      );
    }


    ProductInfo product = jdbc.query(
        "select id, code, name from products where id = :id and deleted_at is null",
        Map.of("id", req.productId()),
        rs -> rs.next() ? new ProductInfo(rs.getLong("id"), rs.getString("code"), rs.getString("name")) : null
    );
    if (product == null) {
      throw new ApiException(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    LocalDate lastDetailedDate = jdbc.queryForObject("""
        select max(c.call_date)
        from doctor_calls c
        join doctor_call_products dcp on dcp.doctor_call_id = c.id
        where c.route_id in (:routeIds)
          and c.call_date between :dateFrom and :dateTo
          and dcp.product_id = :pid
    """, Map.of("routeIds", effectiveRoutes, "dateFrom", range.dateFrom(), "dateTo", range.dateTo(), "pid", req.productId()), LocalDate.class);

    long visitCount = jdbc.queryForObject("""
        select count(*)::bigint
        from doctor_calls c
        join doctor_call_products dcp on dcp.doctor_call_id = c.id
        join doctors d on d.id = c.doctor_id and d.deleted_at is null and d.status = 'ACTIVE'
        where c.route_id in (:routeIds)
          and c.call_date between :dateFrom and :dateTo
          and dcp.product_id = :pid
    """, Map.of("routeIds", effectiveRoutes, "dateFrom", range.dateFrom(), "dateTo", range.dateTo(), "pid", req.productId()), Long.class);

    long uniqueDoctors = jdbc.queryForObject("""
        select count(distinct c.doctor_id)::bigint
        from doctor_calls c
        join doctor_call_products dcp on dcp.doctor_call_id = c.id
        join doctors d on d.id = c.doctor_id and d.deleted_at is null and d.status = 'ACTIVE'
        where c.route_id in (:routeIds)
          and c.call_date between :dateFrom and :dateTo
          and dcp.product_id = :pid
    """, Map.of("routeIds", effectiveRoutes, "dateFrom", range.dateFrom(), "dateTo", range.dateTo(), "pid", req.productId()), Long.class);

    long oosCount = jdbc.queryForObject("""
        select count(*)::bigint
        from chemist_stock_flags f
        join chemist_visits v on v.id = f.visit_id
        where v.route_id in (:routeIds)
          and v.visit_date between :dateFrom and :dateTo
          and f.product_id = :pid
          and f.status = 'OOS'
    """, Map.of("routeIds", effectiveRoutes, "dateFrom", range.dateFrom(), "dateTo", range.dateTo(), "pid", req.productId()), Long.class);

    long lowCount = jdbc.queryForObject("""
        select count(*)::bigint
        from chemist_stock_flags f
        join chemist_visits v on v.id = f.visit_id
        where v.route_id in (:routeIds)
          and v.visit_date between :dateFrom and :dateTo
          and f.product_id = :pid
          and f.status = 'LOW'
    """, Map.of("routeIds", effectiveRoutes, "dateFrom", range.dateFrom(), "dateTo", range.dateTo(), "pid", req.productId()), Long.class);

    var oosByRoute = jdbc.query("""
        select r.code as key, count(*)::bigint as count
        from chemist_stock_flags f
        join chemist_visits v on v.id = f.visit_id
        join routes r on r.id = v.route_id and r.deleted_at is null
        where v.route_id in (:routeIds)
          and v.visit_date between :dateFrom and :dateTo
          and f.product_id = :pid
          and f.status = 'OOS'
        group by r.code
        order by count desc, r.code asc
        limit 20
    """, Map.of("routeIds", effectiveRoutes, "dateFrom", range.dateFrom(), "dateTo", range.dateTo(), "pid", req.productId()),
        (rs, i) -> new OosPoint(rs.getString("key"), rs.getLong("count"))
    );

    return new ProductDetailsResponse(
        new PeriodUsed(range.dateFrom(), range.dateTo()),
        effectiveRoutes.size(),
        product,
        visitCount,
        uniqueDoctors,
        oosCount,
        lowCount,
        oosByRoute,
        lastDetailedDate,
        new Flags(false)
    );
  }

  public enum Period { THIS_MONTH, LAST_MONTH, CUSTOM }
  public record ProductDetailsRequest(Period period, LocalDate dateFrom, LocalDate dateTo, List<Long> routeIds, Long fieldManagerId, Long productId) {}
  public record PeriodUsed(LocalDate dateFrom, LocalDate dateTo) {}
  public record ProductInfo(long id, String code, String name) {}
  public record OosPoint(String key, long count) {}
  public record ProductOosChemistRow(
      long chemistId,
      String chemistName,
      String routeName,
      long oosEvents,
      LocalDate lastOosDate
  ) {}
  public record Flags(boolean oosNotSupported) {}
  public record ProductDetailsResponse(
      PeriodUsed periodUsed,
      int effectiveRouteCount,
      ProductInfo product,
      long visitCount,
      long uniqueDoctors,
      long oosCount,
      long lowCount,
      List<OosPoint> oosByRoute,
      LocalDate lastDetailedDate,
      Flags flags
  ) {}

  @GetMapping("/products/{id}/calls-over-time")
  public List<PointDate> callsOverTime(
      @PathVariable("id") long productId,
      @RequestParam(name = "dateFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
      @RequestParam(name = "dateTo", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
      @RequestParam(name = "routeIds", required = false) List<Long> routeIds,
      @RequestParam(name = "fieldManagerId", required = false) Long fieldManagerId,
      Authentication auth
  ) {
    List<Long> effectiveRoutes = scopeService.resolveEffectiveRouteIds(auth, routeIds, fieldManagerId);
    if (effectiveRoutes == null || effectiveRoutes.isEmpty()) return List.of();

    LocalDate today = LocalDate.now(clock);
    LocalDate df = (dateFrom != null) ? dateFrom : YearMonth.from(today).atDay(1);
    LocalDate dt = (dateTo != null) ? dateTo : today;

    Integer exists = jdbc.queryForObject(
        "select count(*) from products p where p.id = :id and p.deleted_at is null",
        Map.of("id", productId),
        Integer.class
    );
    if (exists == null || exists == 0) throw new ApiException(404, "PRODUCT_NOT_FOUND", "Product not found");

    var params = new java.util.HashMap<String, Object>();
    params.put("pid", productId);
    params.put("routeIds", effectiveRoutes);
    params.put("dateFrom", df);
    params.put("dateTo", dt);

    return jdbc.query("""
        select date_trunc('week', c.call_date)::date as x, count(*)::bigint as y
        from doctor_calls c
        join doctor_call_products dcp on dcp.doctor_call_id = c.id
        where c.route_id in (:routeIds)
          and c.call_date between :dateFrom and :dateTo
          and dcp.product_id = :pid
        group by 1
        order by 1 asc
    """, params, (rs, i) -> new PointDate(rs.getObject("x", LocalDate.class), rs.getLong("y")));
  }

  @GetMapping("/products/{id}/coverage-by-grade")
  public List<GradePoint> coverageByGrade(
      @PathVariable("id") long productId,
      @RequestParam(name = "dateFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
      @RequestParam(name = "dateTo", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
      @RequestParam(name = "routeIds", required = false) List<Long> routeIds,
      @RequestParam(name = "fieldManagerId", required = false) Long fieldManagerId,
      Authentication auth
  ) {
    List<Long> effectiveRoutes = scopeService.resolveEffectiveRouteIds(auth, routeIds, fieldManagerId);
    if (effectiveRoutes == null || effectiveRoutes.isEmpty()) return List.of();

    LocalDate today = LocalDate.now(clock);
    LocalDate df = (dateFrom != null) ? dateFrom : YearMonth.from(today).atDay(1);
    LocalDate dt = (dateTo != null) ? dateTo : today;

    Integer exists = jdbc.queryForObject(
        "select count(*) from products p where p.id = :id and p.deleted_at is null",
        Map.of("id", productId),
        Integer.class
    );
    if (exists == null || exists == 0) throw new ApiException(404, "PRODUCT_NOT_FOUND", "Product not found");

    var params = new java.util.HashMap<String, Object>();
    params.put("pid", productId);
    params.put("routeIds", effectiveRoutes);
    params.put("dateFrom", df);
    params.put("dateTo", dt);

    return jdbc.query("""
        select coalesce(d.grade, 'UNSPECIFIED') as grade, count(distinct c.doctor_id)::bigint as count
        from doctor_calls c
        join doctor_call_products dcp on dcp.doctor_call_id = c.id
        join doctors d on d.id = c.doctor_id and d.deleted_at is null and d.status = 'ACTIVE'
        where c.route_id in (:routeIds)
          and c.call_date between :dateFrom and :dateTo
          and dcp.product_id = :pid
        group by 1
        order by 1 asc
    """, params, (rs, i) -> new GradePoint(rs.getString("grade"), rs.getLong("count")));
  }

  @GetMapping("/products/{id}/top-doctors")
  public PagedResponse<ProductTopDoctorRow> topDoctors(
      @PathVariable("id") long productId,
      @RequestParam(name = "page", required = false) Integer page,
      @RequestParam(name = "size", required = false) Integer size,
      @RequestParam(name = "dateFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
      @RequestParam(name = "dateTo", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
      @RequestParam(name = "routeIds", required = false) List<Long> routeIds,
      @RequestParam(name = "fieldManagerId", required = false) Long fieldManagerId,
      Authentication auth
  ) {
    int p = (page == null) ? 0 : Math.max(0, page);
    int s = (size == null) ? 25 : size;
    if (s < 1) s = 1;
    if (s > 50) s = 50;

    List<Long> effectiveRoutes = scopeService.resolveEffectiveRouteIds(auth, routeIds, fieldManagerId);
    if (effectiveRoutes == null || effectiveRoutes.isEmpty()) return new PagedResponse<>(p, s, 0L, 0, List.of());

    LocalDate today = LocalDate.now(clock);
    LocalDate df = (dateFrom != null) ? dateFrom : YearMonth.from(today).atDay(1);
    LocalDate dt = (dateTo != null) ? dateTo : today;

    Integer exists = jdbc.queryForObject(
        "select count(*) from products p where p.id = :id and p.deleted_at is null",
        Map.of("id", productId),
        Integer.class
    );
    if (exists == null || exists == 0) throw new ApiException(404, "PRODUCT_NOT_FOUND", "Product not found");

    var base = new java.util.HashMap<String, Object>();
    base.put("pid", productId);
    base.put("routeIds", effectiveRoutes);
    base.put("dateFrom", df);
    base.put("dateTo", dt);

    Long total = jdbc.queryForObject("""
        select count(distinct c.doctor_id)::bigint
        from doctor_calls c
        join doctor_call_products dcp on dcp.doctor_call_id = c.id
        where c.route_id in (:routeIds)
          and c.call_date between :dateFrom and :dateTo
          and dcp.product_id = :pid
    """, base, Long.class);
    long totalElements = (total == null) ? 0L : total;
    int totalPages = totalElements == 0 ? 0 : (int) ((totalElements + s - 1) / s);

    var params = new java.util.HashMap<String, Object>(base);
    params.put("limit", s);
    params.put("offset", (long) p * (long) s);

    List<ProductTopDoctorRow> rows = jdbc.query("""
        select
          d.id as doctor_id,
         d.name as doctor_name,
          d.grade as grade,
          count(c.id)::bigint as call_count,
          max(c.call_date) as last_detailed
        from doctor_calls c
        join doctor_call_products dcp on dcp.doctor_call_id = c.id
        join doctors d on d.id = c.doctor_id and d.deleted_at is null and d.status = 'ACTIVE'
        where c.route_id in (:routeIds)
          and c.call_date between :dateFrom and :dateTo
          and dcp.product_id = :pid
        group by d.id, d.name, d.grade
        order by call_count desc, doctor_name asc
        limit :limit offset :offset
    """, params, (rs, i) -> new ProductTopDoctorRow(
        rs.getLong("doctor_id"),
        rs.getString("doctor_name"),
        rs.getString("grade"),
        rs.getLong("call_count"),
        rs.getObject("last_detailed", LocalDate.class)
    ));

    return new PagedResponse<>(p, s, totalElements, totalPages, rows);
  }

  /**
   * Stock-out chemist leaderboard for a single product (OOS only).
   * Used by the Product Detail drilldown to render the "OOS Chemist" table.
   */
  @GetMapping("/products/{id}/oos-chemists")
  public PagedResponse<ProductOosChemistRow> oosChemists(
      @PathVariable("id") long productId,
      @RequestParam(name = "page", required = false) Integer page,
      @RequestParam(name = "size", required = false) Integer size,
      @RequestParam(name = "dateFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
      @RequestParam(name = "dateTo", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
      @RequestParam(name = "routeIds", required = false) List<Long> routeIds,
      @RequestParam(name = "fieldManagerId", required = false) Long fieldManagerId,
      Authentication auth
  ) {
    int p = (page == null) ? 0 : Math.max(0, page);
    int s = (size == null) ? 25 : size;
    if (s < 1) s = 1;
    if (s > 50) s = 50;

    List<Long> effectiveRoutes = scopeService.resolveEffectiveRouteIds(auth, routeIds, fieldManagerId);
    if (effectiveRoutes == null || effectiveRoutes.isEmpty()) {
      return new PagedResponse<>(p, s, 0L, 0, List.of());
    }

    LocalDate today = LocalDate.now(clock);
    LocalDate df = (dateFrom != null) ? dateFrom : YearMonth.from(today).atDay(1);
    LocalDate dt = (dateTo != null) ? dateTo : today;

    Integer exists = jdbc.queryForObject(
        "select count(*) from products p where p.id = :id and p.deleted_at is null",
        Map.of("id", productId),
        Integer.class
    );
    if (exists == null || exists == 0) {
      throw new ApiException(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    var base = new java.util.HashMap<String, Object>();
    base.put("pid", productId);
    base.put("routeIds", effectiveRoutes);
    base.put("dateFrom", df);
    base.put("dateTo", dt);

    Long total = jdbc.queryForObject(
        """
        select count(*)::bigint
        from (
          select c.id
          from chemist_stock_flags f
          join chemist_visits v on v.id = f.visit_id
          join chemists c on c.id = v.chemist_id and c.deleted_at is null
          where v.route_id in (:routeIds)
            and v.visit_date between :dateFrom and :dateTo
            and f.product_id = :pid
            and f.status = 'OOS'
          group by c.id
        ) t
        """,
        base,
        Long.class
    );
    long totalElements = (total == null) ? 0L : total;
    int totalPages = totalElements == 0 ? 0 : (int) ((totalElements + s - 1) / s);

    var params = new java.util.HashMap<String, Object>(base);
    params.put("limit", s);
    params.put("offset", (long) p * (long) s);

    List<ProductOosChemistRow> items = jdbc.query(
        """
        select
          c.id as chemist_id,
          c.name as chemist_name,
          r.name as route_name,
          count(*)::bigint as oos_events,
          max(v.visit_date) as last_oos_date
        from chemist_stock_flags f
        join chemist_visits v on v.id = f.visit_id
        join chemists c on c.id = v.chemist_id and c.deleted_at is null
        join routes r on r.id = v.route_id and r.deleted_at is null
        where v.route_id in (:routeIds)
          and v.visit_date between :dateFrom and :dateTo
          and f.product_id = :pid
          and f.status = 'OOS'
        group by c.id, c.name, r.name
        order by oos_events desc, last_oos_date desc nulls last, chemist_name asc
        limit :limit offset :offset
        """,
        params,
        (rs, i) -> new ProductOosChemistRow(
            rs.getLong("chemist_id"),
            rs.getString("chemist_name"),
            rs.getString("route_name"),
            rs.getLong("oos_events"),
            rs.getObject("last_oos_date", LocalDate.class)
        )
    );

    return new PagedResponse<>(p, s, totalElements, totalPages, items);
  }

  public record PointDate(LocalDate x, long y) {}
  public record GradePoint(String grade, long count) {}
  public record ProductTopDoctorRow(long doctorId, String doctorName, String grade, long callCount, LocalDate lastDetailed) {}
  public record OosChemistRow(long chemistId, String chemistName, String routeName, String routeCode, long oosEvents, LocalDate lastOosDate) {}
  public record PagedResponse<T>(int page, int size, long totalElements, int totalPages, List<T> items) {}


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
