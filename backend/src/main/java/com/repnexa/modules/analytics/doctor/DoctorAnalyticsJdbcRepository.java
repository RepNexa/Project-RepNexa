package com.repnexa.modules.analytics.doctor;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DoctorAnalyticsJdbcRepository {

  private final NamedParameterJdbcTemplate jdbc;

  public DoctorAnalyticsJdbcRepository(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public boolean doctorExists(long doctorId) {
    Integer one = jdbc.query(
        "select 1 from doctors d where d.id = :id and d.deleted_at is null and d.status = 'ACTIVE'",
        Map.of("id", doctorId),
        rs -> rs.next() ? 1 : null
    );
    return one != null;
  }

  public boolean doctorHasRouteInScope(long doctorId, List<Long> routeIds) {
    if (routeIds == null || routeIds.isEmpty()) return false;
    Integer one = jdbc.query(
        """
        select 1
        from doctor_routes dr
        join doctors d on d.id = dr.doctor_id and d.deleted_at is null and d.status = 'ACTIVE'
        where dr.doctor_id = :doctorId
          and dr.route_id in (:routeIds)
        limit 1
        """,
        Map.of("doctorId", doctorId, "routeIds", routeIds),
        rs -> rs.next() ? 1 : null
    );
    return one != null;
  }

  public List<DoctorAnalyticsController.DoctorRow> doctorDetails(
      List<Long> routeIds,
      LocalDate dateFrom,
      LocalDate dateTo,
      Long doctorId,
      String gradeOrNull
  ) {
    var params = new java.util.HashMap<String, Object>();
    params.put("routeIds", routeIds);
    params.put("dateFrom", dateFrom);
    params.put("dateTo", dateTo);
    params.put("grade", gradeOrNull);
    params.put("doctorId", doctorId);

    String sql =
        """
        select
          d.id as doctor_id,
          d.name as doctor_name,
          count(c.id) as visit_count,
          max(c.call_date) as last_visit_date
        from doctor_calls c
        join doctors d on d.id = c.doctor_id
        where c.route_id in (:routeIds)
          and c.call_date >= :dateFrom
          and c.call_date <= :dateTo
          and d.deleted_at is null
          and d.status = 'ACTIVE'
          and (
            cast(:grade as text) is null
            or (case when d.grade in ('A','B','C') then d.grade else 'C' end) = cast(:grade as text)
          )
        """ + (doctorId != null ? " and d.id = :doctorId " : "") +
        """
        group by d.id, d.name
        order by visit_count desc, d.name asc
        limit 200
        """;

    return jdbc.query(sql, params, (rs, i) -> new DoctorAnalyticsController.DoctorRow(
        rs.getLong("doctor_id"),
        rs.getString("doctor_name"),
        rs.getLong("visit_count"),
        readLocalDate(rs, "last_visit_date")
    ));
  }

  public long countDoctorVisitLog(long doctorId, List<Long> routeIds, LocalDate dateFrom, LocalDate dateTo) {
    return jdbc.queryForObject(
        """
        select count(*)
        from doctor_calls c
        where c.doctor_id = :doctorId
          and c.route_id in (:routeIds)
          and c.call_date >= :dateFrom
          and c.call_date <= :dateTo
        """,
        Map.of("doctorId", doctorId, "routeIds", routeIds, "dateFrom", dateFrom, "dateTo", dateTo),
        Long.class
    );
  }

  public List<DoctorAnalyticsController.DoctorVisitLogItem> fetchDoctorVisitLog(
      long doctorId,
      List<Long> routeIds,
      LocalDate dateFrom,
      LocalDate dateTo,
      int limit,
      int offset
  ) {
    return jdbc.query(
        """
        select
          c.id as call_id,
          c.call_date,
          c.route_id,
          r.code as route_code,
          r.name as route_name,
          c.rep_user_id,
          u.username as rep_username,
          c.call_type,
          coalesce(array_agg(p.code order by p.code) filter (where p.id is not null), '{}'::text[]) as product_codes
        from doctor_calls c
        join users u on u.id = c.rep_user_id
        join routes r on r.id = c.route_id and r.deleted_at is null
        left join doctor_call_products dcp on dcp.doctor_call_id = c.id
        left join products p on p.id = dcp.product_id and p.deleted_at is null
        where c.doctor_id = :doctorId
          and c.route_id in (:routeIds)
          and c.call_date >= :dateFrom
          and c.call_date <= :dateTo
        group by c.id, c.call_date, c.route_id, r.code, r.name, c.rep_user_id, u.username, c.call_type
        order by c.call_date desc, c.id desc
        limit :limit offset :offset
        """,
        Map.of(
            "doctorId", doctorId,
            "routeIds", routeIds,
            "dateFrom", dateFrom,
            "dateTo", dateTo,
            "limit", limit,
            "offset", offset
        ),
        new RowMapper<>() {
          @Override
          public DoctorAnalyticsController.DoctorVisitLogItem mapRow(ResultSet rs, int rowNum) throws SQLException {
            java.sql.Array arr = rs.getArray("product_codes");
            List<String> codes = List.of();
            if (arr != null) {
              Object a = arr.getArray();
              if (a instanceof String[] s) {
                codes = Arrays.asList(s);
              }
            }
            return new DoctorAnalyticsController.DoctorVisitLogItem(
                rs.getLong("call_id"),
                readLocalDate(rs, "call_date"),
                rs.getLong("route_id"),
                rs.getString("route_code"),
                rs.getString("route_name"),
                rs.getLong("rep_user_id"),
                rs.getString("rep_username"),
                rs.getString("call_type"),
                codes
            );
          }
        }
    );
  }

  private static LocalDate readLocalDate(ResultSet rs, String col) throws SQLException {
    try {
      LocalDate d = rs.getObject(col, LocalDate.class);
      if (d != null) return d;
    } catch (Exception ignored) {
      // fallback below
    }
    Timestamp ts = rs.getTimestamp(col);
    return ts == null ? null : ts.toLocalDateTime().toLocalDate();
  }
}