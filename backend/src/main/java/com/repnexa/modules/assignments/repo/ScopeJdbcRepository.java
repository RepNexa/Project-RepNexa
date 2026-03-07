package com.repnexa.modules.assignments.repo;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public class ScopeJdbcRepository {

    private final JdbcTemplate jdbc;

    public ScopeJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Long> listAllowedRouteIdsForFm(long fmUserId) {
        return jdbc.query("""
            SELECT r.id
            FROM routes r
            JOIN territories t ON t.id = r.territory_id
            WHERE r.deleted_at IS NULL
              AND t.deleted_at IS NULL
              AND t.owner_user_id = ?
            ORDER BY r.id
        """, (rs, i) -> rs.getLong("id"), fmUserId);
    }

    public List<Long> listAllActiveRouteIdsForCm() {
        return jdbc.query("""
            SELECT r.id
            FROM routes r
            JOIN territories t ON t.id = r.territory_id
            WHERE r.deleted_at IS NULL
              AND t.deleted_at IS NULL
            ORDER BY r.id
        """, (rs, i) -> rs.getLong("id"));
    }

    public List<Long> listAllowedRouteIdsForMr(long repUserId) {
        return jdbc.query("""
            SELECT DISTINCT a.route_id AS id
            FROM rep_route_assignments a
            JOIN routes r ON r.id = a.route_id
            JOIN territories t ON t.id = r.territory_id
            WHERE a.rep_user_id = ?
              AND a.enabled = TRUE
              AND a.start_date <= CURRENT_DATE
              AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
              AND r.deleted_at IS NULL
              AND t.deleted_at IS NULL
            ORDER BY a.route_id
        """, (rs, i) -> rs.getLong("id"), repUserId);
    }

    public boolean isRouteOwnedByFm(long fmUserId, long routeId) {
        Integer cnt = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM routes r
            JOIN territories t ON t.id = r.territory_id
            WHERE r.id = ?
              AND r.deleted_at IS NULL
              AND t.deleted_at IS NULL
              AND t.owner_user_id = ?
        """, Integer.class, routeId, fmUserId);
        return cnt != null && cnt > 0;
    }

    public boolean isRouteAssignedToMr(long repUserId, long routeId) {
        Integer cnt = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM rep_route_assignments a
            JOIN routes r ON r.id = a.route_id
            JOIN territories t ON t.id = r.territory_id
            WHERE a.rep_user_id = ?
              AND a.route_id = ?
              AND a.enabled = TRUE
              AND a.start_date <= CURRENT_DATE
              AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
              AND r.deleted_at IS NULL
              AND t.deleted_at IS NULL
        """, Integer.class, repUserId, routeId);
        return cnt != null && cnt > 0;
    }

    public boolean isActiveRoute(long routeId) {
        Integer cnt = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM routes r
            JOIN territories t ON t.id = r.territory_id
            WHERE r.id = ?
              AND r.deleted_at IS NULL
              AND t.deleted_at IS NULL
        """, Integer.class, routeId);
        return cnt != null && cnt > 0;
    }

    public boolean isActiveDoctor(long doctorId) {
        Integer cnt = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM doctors d
            WHERE d.id = ?
              AND d.deleted_at IS NULL
        """, Integer.class, doctorId);
        return cnt != null && cnt > 0;
    }

    public record MrAssignment(long repRouteAssignmentId, long routeId) {}

    public Optional<MrAssignment> getActiveMrAssignment(long repUserId, long repRouteAssignmentId) {
        List<MrAssignment> rows = jdbc.query("""
            SELECT a.id AS rep_route_assignment_id, a.route_id
            FROM rep_route_assignments a
            JOIN routes r ON r.id = a.route_id
            JOIN territories t ON t.id = r.territory_id
            WHERE a.id = ?
              AND a.rep_user_id = ?
              AND a.enabled = TRUE
              AND a.start_date <= CURRENT_DATE
              AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
              AND r.deleted_at IS NULL
              AND t.deleted_at IS NULL
            LIMIT 1
        """, (rs, i) -> new MrAssignment(
                rs.getLong("rep_route_assignment_id"),
                rs.getLong("route_id")
        ), repRouteAssignmentId, repUserId);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public boolean isActiveDoctorInRoute(long doctorId, long routeId) {
        Integer cnt = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM doctor_routes dr
            JOIN doctors d ON d.id = dr.doctor_id
            JOIN routes r ON r.id = dr.route_id
            JOIN territories t ON t.id = r.territory_id
            WHERE dr.doctor_id = ?
              AND dr.route_id = ?
              AND d.deleted_at IS NULL
              AND r.deleted_at IS NULL
              AND t.deleted_at IS NULL
        """, Integer.class, doctorId, routeId);
        return cnt != null && cnt > 0;
    }

    public Set<Long> findMissingActiveProductIds(List<Long> productIds) {
        if (productIds == null || productIds.isEmpty()) return Set.of();

        Set<Long> requested = new HashSet<>(productIds);

        // Create the SQL array using the PreparedStatement's connection (no manual Connection handling).
        final java.sql.Array[] sqlArrayHolder = new java.sql.Array[1];

        List<Long> found = jdbc.query("""
            SELECT id
            FROM products
            WHERE deleted_at IS NULL
              AND id = ANY (?)
        """,
                ps -> {
                    java.sql.Array sqlArray = ps.getConnection()
                            .createArrayOf("bigint", requested.toArray());
                    sqlArrayHolder[0] = sqlArray;
                    ps.setArray(1, sqlArray);
                },
                (rs, i) -> rs.getLong("id")
        );

        // Free the SQL array (best-effort). Statement/connection lifecycle is managed by JdbcTemplate.
        if (sqlArrayHolder[0] != null) {
            try {
                sqlArrayHolder[0].free();
            } catch (java.sql.SQLException ignored) {
                // ignore
            }
        }

        Set<Long> foundSet = new HashSet<>(found);
        requested.removeAll(foundSet);
        return requested;
    }

    public int countOverlappingAssignments(long repUserId, long routeId,
                                        java.time.LocalDate newStart,
                                        java.time.LocalDate newEnd,
                                        Long excludeId) {
        // overlap if existing end is null or >= newStart AND (newEnd is null OR existing start <= newEnd)
        Integer cnt = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM rep_route_assignments a
            WHERE a.rep_user_id = ?
            AND a.route_id = ?
            AND ( ?::bigint IS NULL OR a.id <> ?::bigint )
            AND (a.end_date IS NULL OR a.end_date >= ?)
            AND ( ?::date IS NULL OR a.start_date <= ?::date )
        """, Integer.class,
                repUserId, routeId,
                excludeId, excludeId,
                newStart,
                newEnd, newEnd
        );
        return cnt == null ? 0 : cnt;
    }

}
