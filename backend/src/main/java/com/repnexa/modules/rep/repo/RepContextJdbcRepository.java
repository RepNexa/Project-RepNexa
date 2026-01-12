package com.repnexa.modules.rep.repo;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class RepContextJdbcRepository {

    private final JdbcTemplate jdbc;

    public RepContextJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Row> findActiveAssignedRoutes(long repUserId) {
        return jdbc.query("""
            SELECT
              a.id AS assignment_id,
              r.id AS route_id,
              r.code AS route_code,
              r.name AS route_name,
              t.id AS territory_id,
              t.code AS territory_code,
              t.name AS territory_name
            FROM rep_route_assignments a
            JOIN routes r ON r.id = a.route_id
            JOIN territories t ON t.id = r.territory_id
            WHERE a.rep_user_id = ?
              AND a.enabled = TRUE
              AND a.start_date <= CURRENT_DATE
              AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
              AND r.deleted_at IS NULL
              AND t.deleted_at IS NULL
            ORDER BY t.name, r.name
        """, (rs, i) -> new Row(
                rs.getLong("assignment_id"),
                rs.getLong("route_id"),
                rs.getString("route_code"),
                rs.getString("route_name"),
                rs.getLong("territory_id"),
                rs.getString("territory_code"),
                rs.getString("territory_name")
        ), repUserId);
    }

    public record Row(
            long repRouteAssignmentId,
            long routeId,
            String routeCode,
            String routeName,
            long territoryId,
            String territoryCode,
            String territoryName
    ) {}
}
