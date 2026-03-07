package com.repnexa.modules.analytics.company.repo;

import com.repnexa.modules.analytics.company.dto.CompanyOverviewDtos;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CompanyOverviewJdbcRepository {

    private final NamedParameterJdbcTemplate named;

    public CompanyOverviewJdbcRepository(JdbcTemplate jdbc) {
        this.named = new NamedParameterJdbcTemplate(jdbc);
    }

    public record GradeCoverageAgg(
            String grade,
            long totalDoctors,
            long coveredDoctors
    ) {}

    public record VisitStats(long totalDoctors, long coveredDoctors, long visits) {}

    public record RepVisitAgg(long repUserId, String repUsername, long visits) {}

    public record TargetAchievementAgg(long repUserId, String repUsername, Double achievement) {}

    public VisitStats getVisitStats(List<Long> routeIds, LocalDate dateFrom, LocalDate dateTo) {
        if (routeIds == null || routeIds.isEmpty()) return new VisitStats(0, 0, 0);

        Map<String, Object> p = Map.of(
                "routeIds", routeIds,
                "dateFrom", dateFrom,
                "dateTo", dateTo
        );

        Long totalDoctors = named.queryForObject("""
            SELECT COUNT(DISTINCT dr.doctor_id)
            FROM doctor_routes dr
            JOIN doctors d ON d.id = dr.doctor_id AND d.deleted_at IS NULL
            JOIN routes r ON r.id = dr.route_id AND r.deleted_at IS NULL
            JOIN territories t ON t.id = r.territory_id AND t.deleted_at IS NULL
            WHERE dr.route_id IN (:routeIds)
              AND d.status = 'ACTIVE'
        """, p, Long.class);

        Long coveredDoctors = named.queryForObject("""
            SELECT COUNT(DISTINCT dc.doctor_id)
            FROM doctor_calls dc
            JOIN doctors d ON d.id = dc.doctor_id AND d.deleted_at IS NULL
            JOIN routes r ON r.id = dc.route_id AND r.deleted_at IS NULL
            JOIN territories t ON t.id = r.territory_id AND t.deleted_at IS NULL
            WHERE dc.route_id IN (:routeIds)
              AND dc.call_date BETWEEN :dateFrom AND :dateTo
              AND d.status = 'ACTIVE'
        """, p, Long.class);

        Long visits = named.queryForObject("""
            SELECT COUNT(*)
            FROM doctor_calls dc
            JOIN routes r ON r.id = dc.route_id AND r.deleted_at IS NULL
            JOIN territories t ON t.id = r.territory_id AND t.deleted_at IS NULL
            JOIN doctors d ON d.id = dc.doctor_id AND d.deleted_at IS NULL
            WHERE dc.route_id IN (:routeIds)
              AND dc.call_date BETWEEN :dateFrom AND :dateTo
              AND d.status = 'ACTIVE'
        """, p, Long.class);

        return new VisitStats(
                totalDoctors == null ? 0 : totalDoctors,
                coveredDoctors == null ? 0 : coveredDoctors,
                visits == null ? 0 : visits
        );
    }

    public long countDoctorsAtRisk14d(List<Long> routeIds, LocalDate asOfDate) {
        if (routeIds == null || routeIds.isEmpty()) return 0;

        LocalDate riskFrom = asOfDate.minusDays(13); // inclusive 14-day window
        Map<String, Object> p = Map.of(
                "routeIds", routeIds,
                "riskFrom", riskFrom,
                "riskTo", asOfDate
        );

        Long cnt = named.queryForObject("""
            WITH docs AS (
                SELECT DISTINCT dr.doctor_id
                FROM doctor_routes dr
                JOIN doctors d ON d.id = dr.doctor_id AND d.deleted_at IS NULL
                JOIN routes r ON r.id = dr.route_id AND r.deleted_at IS NULL
                JOIN territories t ON t.id = r.territory_id AND t.deleted_at IS NULL
                WHERE dr.route_id IN (:routeIds)
                  AND d.status = 'ACTIVE'
            )
            SELECT COUNT(*)
            FROM docs
            LEFT JOIN doctor_calls dc
                   ON dc.doctor_id = docs.doctor_id
                  AND dc.route_id IN (:routeIds)
                  AND dc.call_date BETWEEN :riskFrom AND :riskTo
            WHERE dc.id IS NULL
        """, p, Long.class);

        return cnt == null ? 0 : cnt;
    }

    public VisitStats getVisitStatsByGrade(List<Long> routeIds, LocalDate dateFrom, LocalDate dateTo, String grade) {
        if (routeIds == null || routeIds.isEmpty()) return new VisitStats(0L, 0L, 0L);

        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("routeIds", routeIds)
                .addValue("dateFrom", dateFrom)
                .addValue("dateTo", dateTo)
                .addValue("grade", grade);

        return named.queryForObject("""
                WITH docs AS (
                    SELECT DISTINCT dr.doctor_id
                    FROM doctor_routes dr
                    JOIN doctors d ON d.id = dr.doctor_id AND d.deleted_at IS NULL
                    WHERE dr.route_id IN (:routeIds)
                      AND d.status = 'ACTIVE'
                      AND d.grade = :grade
                ),
                covered AS (
                    SELECT DISTINCT dc.doctor_id
                    FROM doctor_calls dc
                    WHERE dc.route_id IN (:routeIds)
                      AND dc.call_date >= :dateFrom
                      AND dc.call_date <= :dateTo
                      AND dc.doctor_id IN (SELECT doctor_id FROM docs)
                ),
                v AS (
                    SELECT COUNT(*) AS visits
                    FROM doctor_calls dc
                    JOIN doctors d ON d.id = dc.doctor_id AND d.deleted_at IS NULL
                    WHERE dc.route_id IN (:routeIds)
                      AND dc.call_date >= :dateFrom
                      AND dc.call_date <= :dateTo
                      AND d.status = 'ACTIVE'
                      AND d.grade = :grade
                )
                SELECT
                    (SELECT COUNT(*) FROM docs) AS total_doctors,
                    (SELECT COUNT(*) FROM covered) AS covered_doctors,
                    COALESCE((SELECT visits FROM v), 0) AS visits
                """, p, (rs, i) -> new VisitStats(
                        rs.getLong("total_doctors"),
                        rs.getLong("covered_doctors"),
                        rs.getLong("visits")
                ));
    }

    public List<GradeCoverageAgg> getCoverageAggByGrade(List<Long> routeIds, LocalDate dateFrom, LocalDate dateTo) {
        if (routeIds == null || routeIds.isEmpty()) return List.of();

        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("routeIds", routeIds)
                .addValue("dateFrom", dateFrom)
                .addValue("dateTo", dateTo);

        return named.query("""
                WITH docs AS (
                    SELECT DISTINCT d.id AS doctor_id, d.grade AS grade
                    FROM doctor_routes dr
                    JOIN doctors d ON d.id = dr.doctor_id AND d.deleted_at IS NULL
                    WHERE dr.route_id IN (:routeIds)
                      AND d.status = 'ACTIVE'
                      AND d.grade IN ('A','B','C')
                ),
                covered AS (
                    SELECT DISTINCT dc.doctor_id
                    FROM doctor_calls dc
                    WHERE dc.route_id IN (:routeIds)
                      AND dc.call_date >= :dateFrom
                      AND dc.call_date <= :dateTo
                )
                SELECT
                    docs.grade AS grade,
                    COUNT(*) AS total_doctors,
                    COUNT(covered.doctor_id) AS covered_doctors
                FROM docs
                LEFT JOIN covered ON covered.doctor_id = docs.doctor_id
                GROUP BY docs.grade
                """, p, (rs, i) -> new GradeCoverageAgg(
                        rs.getString("grade"),
                        rs.getLong("total_doctors"),
                        rs.getLong("covered_doctors")
                ));
    }


    public List<CompanyOverviewDtos.RepPerformanceDetailRow> listRepPerformanceDetail(
            List<Long> routeIds,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {
        if (routeIds == null || routeIds.isEmpty()) return List.of();
        return named.query("""
            SELECT
              c.rep_user_id AS rep_user_id,
              u.username AS username,
              COALESCE(STRING_AGG(DISTINCT COALESCE(t.name, t.code), ', '), '') AS territory,
              COUNT(*)::bigint AS total_visits,
              COUNT(DISTINCT c.doctor_id)::bigint AS unique_doctors,
              SUM(CASE WHEN d.grade = 'A' THEN 1 ELSE 0 END)::bigint AS a_visits,
              SUM(CASE WHEN d.grade = 'B' THEN 1 ELSE 0 END)::bigint AS b_visits,
              SUM(CASE WHEN d.grade = 'C' THEN 1 ELSE 0 END)::bigint AS c_visits
            FROM doctor_calls c
            JOIN users u ON u.id = c.rep_user_id
            JOIN routes r ON r.id = c.route_id AND r.deleted_at IS NULL
            JOIN territories t ON t.id = r.territory_id AND t.deleted_at IS NULL
            JOIN doctors d ON d.id = c.doctor_id AND d.deleted_at IS NULL AND d.status = 'ACTIVE'
            WHERE c.route_id IN (:routeIds)
              AND c.call_date BETWEEN :dateFrom AND :dateTo
            GROUP BY c.rep_user_id, u.username
            ORDER BY total_visits DESC, u.username ASC
            LIMIT 50
        """, Map.of("routeIds", routeIds, "dateFrom", dateFrom, "dateTo", dateTo),
            (rs, i) -> new CompanyOverviewDtos.RepPerformanceDetailRow(
                rs.getLong("rep_user_id"),
                rs.getString("username"),
                rs.getString("territory"),
                rs.getLong("total_visits"),
                rs.getLong("unique_doctors"),
                rs.getLong("a_visits"),
                rs.getLong("b_visits"),
                rs.getLong("c_visits")
            )
        );
    }

    public List<CompanyOverviewDtos.ProductCoverageByGradeRow> listProductCoverageByGrade(
            List<Long> routeIds,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {
        if (routeIds == null || routeIds.isEmpty()) return List.of();
        return named.query("""
            WITH hits AS (
              SELECT DISTINCT dcp.product_id, c.doctor_id
              FROM doctor_calls c
              JOIN doctors d ON d.id = c.doctor_id AND d.deleted_at IS NULL AND d.status = 'ACTIVE'
              JOIN doctor_call_products dcp ON dcp.doctor_call_id = c.id
              WHERE c.route_id IN (:routeIds)
                AND c.call_date BETWEEN :dateFrom AND :dateTo
            )
            SELECT
              p.code,
              p.name,
              COUNT(DISTINCT h.doctor_id)::bigint AS all_doctors,
              COUNT(DISTINCT CASE WHEN d.grade = 'A' THEN h.doctor_id END)::bigint AS a_doctors,
              COUNT(DISTINCT CASE WHEN d.grade = 'B' THEN h.doctor_id END)::bigint AS b_doctors,
              COUNT(DISTINCT CASE WHEN d.grade = 'C' THEN h.doctor_id END)::bigint AS c_doctors
            FROM hits h
            JOIN products p ON p.id = h.product_id AND p.deleted_at IS NULL
            LEFT JOIN doctors d ON d.id = h.doctor_id AND d.deleted_at IS NULL AND d.status = 'ACTIVE'
            GROUP BY p.code, p.name
            ORDER BY all_doctors DESC, p.code ASC
            LIMIT 20
        """, Map.of("routeIds", routeIds, "dateFrom", dateFrom, "dateTo", dateTo),
            (rs, i) -> new CompanyOverviewDtos.ProductCoverageByGradeRow(
                rs.getString("code"),
                rs.getString("name"),
                rs.getLong("all_doctors"),
                rs.getLong("a_doctors"),
                rs.getLong("b_doctors"),
                rs.getLong("c_doctors")
            )
        );
    }

    public List<CompanyOverviewDtos.OosPoint> listOosByTerritory(List<Long> routeIds, LocalDate dateFrom, LocalDate dateTo) {
        if (routeIds == null || routeIds.isEmpty()) return List.of();
        return named.query("""
            SELECT COALESCE(t.name, t.code) AS key, COUNT(*)::bigint AS count
            FROM chemist_stock_flags f
            JOIN chemist_visits v ON v.id = f.visit_id
            JOIN routes r ON r.id = v.route_id AND r.deleted_at IS NULL
            JOIN territories t ON t.id = r.territory_id AND t.deleted_at IS NULL
            WHERE v.route_id IN (:routeIds)
              AND v.visit_date BETWEEN :dateFrom AND :dateTo
              AND f.status = 'OOS'
            GROUP BY COALESCE(t.name, t.code)
            ORDER BY count DESC, key ASC
            LIMIT 20
        """, Map.of("routeIds", routeIds, "dateFrom", dateFrom, "dateTo", dateTo),
            (rs, i) -> new CompanyOverviewDtos.OosPoint(rs.getString("key"), rs.getLong("count"))
        );
    }

    public List<RepVisitAgg> listRepVisitAgg(List<Long> routeIds, LocalDate dateFrom, LocalDate dateTo) {
        if (routeIds == null || routeIds.isEmpty()) return List.of();
        return named.query("""
            SELECT c.rep_user_id, u.username, COUNT(*) AS visits
            FROM doctor_calls c
            JOIN users u ON u.id = c.rep_user_id
            JOIN doctors d ON d.id = c.doctor_id AND d.deleted_at IS NULL AND d.status = 'ACTIVE'
            WHERE c.route_id IN (:routeIds)
              AND c.call_date BETWEEN :dateFrom AND :dateTo
            GROUP BY c.rep_user_id, u.username
            ORDER BY visits DESC, u.username ASC
        """, Map.of("routeIds", routeIds, "dateFrom", dateFrom, "dateTo", dateTo),
            (rs, i) -> new RepVisitAgg(
                rs.getLong("rep_user_id"),
                rs.getString("username"),
                rs.getLong("visits")
            )
       );
    }

    public List<TargetAchievementAgg> listTargetAchievementAgg(
        List<Long> routeIds,
        LocalDate dateFrom,
        LocalDate dateTo,
        int targetA,
        int targetB,
        int targetC
    ) {
        if (routeIds == null || routeIds.isEmpty()) return List.of();
        return named.query("""
            WITH assignments AS (
              SELECT a.rep_user_id, a.route_id
              FROM rep_route_assignments a
              WHERE a.enabled = TRUE
                AND a.route_id IN (:routeIds)
                AND a.start_date <= :dateTo
                AND (a.end_date IS NULL OR a.end_date >= :dateFrom)
            ),
            docs AS (
              SELECT
                a.rep_user_id,
                (CASE WHEN d.grade IN ('A','B','C') THEN d.grade ELSE 'C' END) AS grade,
                COUNT(DISTINCT dr.doctor_id) AS doctors
              FROM assignments a
              JOIN doctor_routes dr ON dr.route_id = a.route_id
              JOIN doctors d ON d.id = dr.doctor_id AND d.deleted_at IS NULL AND d.status = 'ACTIVE'
              GROUP BY a.rep_user_id, (CASE WHEN d.grade IN ('A','B','C') THEN d.grade ELSE 'C' END)
            ),
            req AS (
              SELECT
                rep_user_id,
                SUM(
                  CASE grade
                    WHEN 'A' THEN doctors * :targetA
                    WHEN 'B' THEN doctors * :targetB
                    WHEN 'C' THEN doctors * :targetC
                    ELSE 0
                  END
                ) AS required_visits
              FROM docs
              GROUP BY rep_user_id
            ),
            vis AS (
              SELECT c.rep_user_id, COUNT(*) AS visits
              FROM doctor_calls c
              JOIN doctors d ON d.id = c.doctor_id AND d.deleted_at IS NULL AND d.status = 'ACTIVE'
              WHERE c.route_id IN (:routeIds)
                AND c.call_date BETWEEN :dateFrom AND :dateTo
              GROUP BY c.rep_user_id
            ),
            reps AS (
              SELECT DISTINCT rep_user_id FROM assignments
              UNION
              SELECT DISTINCT rep_user_id FROM vis
            )
            SELECT u.id AS rep_user_id,
                   u.username,
                   CASE WHEN COALESCE(r.required_visits, 0) = 0 THEN NULL
                        ELSE (COALESCE(v.visits, 0)::double precision / r.required_visits)
                   END AS achievement
            FROM reps x
            JOIN users u ON u.id = x.rep_user_id
            LEFT JOIN req r ON r.rep_user_id = x.rep_user_id
            LEFT JOIN vis v ON v.rep_user_id = x.rep_user_id
            ORDER BY achievement DESC NULLS LAST, u.username ASC
        """, Map.of(
            "routeIds", routeIds,
            "dateFrom", dateFrom,
            "dateTo", dateTo,
            "targetA", targetA,
            "targetB", targetB,
            "targetC", targetC
        ), (rs, i) -> new TargetAchievementAgg(
            rs.getLong("rep_user_id"),
            rs.getString("username"),
            (Double) rs.getObject("achievement")
        ));
    }

    public List<CompanyOverviewDtos.ProductCoverageCell> listProductCoverageMatrix(
        List<Long> routeIds,
        LocalDate dateFrom,
        LocalDate dateTo,
        String gradeOrNull
    ) {
        if (routeIds == null || routeIds.isEmpty()) return List.of();
        MapSqlParameterSource p = new MapSqlParameterSource()
            .addValue("routeIds", routeIds)
            .addValue("dateFrom", dateFrom)
            .addValue("dateTo", dateTo)
            .addValue("g", gradeOrNull); // may be null

        return named.query("""
            WITH docs AS (
              SELECT DISTINCT
                dr.doctor_id,
                (CASE WHEN d.grade IN ('A','B','C') THEN d.grade ELSE 'C' END) AS g
              FROM doctor_routes dr
              JOIN doctors d ON d.id = dr.doctor_id AND d.deleted_at IS NULL AND d.status = 'ACTIVE'
              WHERE dr.route_id IN (:routeIds)
            ),
            tot AS (
              SELECT COUNT(*) AS total
              FROM docs
              WHERE (cast(:g as text) IS NULL OR g = cast(:g as text))
            ),
            prod AS (
              SELECT
                p.code,
                p.name,
                COUNT(DISTINCT c.doctor_id) AS covered
              FROM doctor_calls c
              JOIN doctors d ON d.id = c.doctor_id AND d.deleted_at IS NULL AND d.status = 'ACTIVE'
              JOIN doctor_call_products dcp ON dcp.doctor_call_id = c.id
              JOIN products p ON p.id = dcp.product_id AND p.deleted_at IS NULL
              WHERE c.route_id IN (:routeIds)
                AND c.call_date BETWEEN :dateFrom AND :dateTo
                AND (cast(:g as text) IS NULL OR (CASE WHEN d.grade IN ('A','B','C') THEN d.grade ELSE 'C' END) = cast(:g as text))
              GROUP BY p.code, p.name
            )
            SELECT
              prod.code,
              prod.name,
              CASE WHEN tot.total = 0 THEN NULL ELSE prod.covered::double precision / tot.total END AS coverage
            FROM prod CROSS JOIN tot
            ORDER BY coverage DESC NULLS LAST, prod.code ASC
            LIMIT 20
        """, p, (rs, i) -> new CompanyOverviewDtos.ProductCoverageCell(
            rs.getString("code"),
            rs.getString("name"),
            (Double) rs.getObject("coverage")
        ));

    }

    public List<CompanyOverviewDtos.OosPoint> listOosByProduct(List<Long> routeIds, LocalDate dateFrom, LocalDate dateTo) {
        if (routeIds == null || routeIds.isEmpty()) return List.of();
        return named.query("""
            SELECT p.code AS key, COUNT(*)::bigint AS count
            FROM chemist_stock_flags f
            JOIN chemist_visits v ON v.id = f.visit_id
            JOIN products p ON p.id = f.product_id AND p.deleted_at IS NULL
            WHERE v.route_id IN (:routeIds)
              AND v.visit_date BETWEEN :dateFrom AND :dateTo
              AND f.status = 'OOS'
            GROUP BY p.code
            ORDER BY count DESC, p.code ASC
            LIMIT 20
        """, Map.of("routeIds", routeIds, "dateFrom", dateFrom, "dateTo", dateTo),
            (rs, i) -> new CompanyOverviewDtos.OosPoint(rs.getString("key"), rs.getLong("count"))
        );
    }

    public List<CompanyOverviewDtos.OosPoint> listOosByRoute(List<Long> routeIds, LocalDate dateFrom, LocalDate dateTo) {
        if (routeIds == null || routeIds.isEmpty()) return List.of();
        return named.query("""
            SELECT r.code AS key, COUNT(*)::bigint AS count
            FROM chemist_stock_flags f
            JOIN chemist_visits v ON v.id = f.visit_id
            JOIN routes r ON r.id = v.route_id AND r.deleted_at IS NULL
            WHERE v.route_id IN (:routeIds)
              AND v.visit_date BETWEEN :dateFrom AND :dateTo
              AND f.status = 'OOS'
            GROUP BY r.code
            ORDER BY count DESC, r.code ASC
            LIMIT 20
        """, Map.of("routeIds", routeIds, "dateFrom", dateFrom, "dateTo", dateTo),
            (rs, i) -> new CompanyOverviewDtos.OosPoint(rs.getString("key"), rs.getLong("count"))
        );
    }
}