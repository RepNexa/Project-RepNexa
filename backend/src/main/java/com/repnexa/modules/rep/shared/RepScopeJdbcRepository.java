package com.repnexa.modules.rep.shared;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.*;
import java.util.stream.Collectors;

@Repository
public class RepScopeJdbcRepository {

    private final JdbcTemplate jdbc;

    public RepScopeJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record MrAssignment(long repRouteAssignmentId, long routeId) {}

    /**
     * Active assignment for the logged-in MR.
     * Note: Uses CURRENT_DATE to match the rest of the repo's earlier behavior.
     */
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

    /**
     * MVP assumption: chemists are single-route (chemists.route_id).
     * Also enforces soft-delete (chemist + route + territory).
     */
    public boolean isActiveChemistInRoute(long chemistId, long routeId) {
        Integer cnt = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM chemists c
            JOIN routes r ON r.id = c.route_id
            JOIN territories t ON t.id = r.territory_id
            WHERE c.id = ?
              AND c.route_id = ?
              AND c.deleted_at IS NULL
              AND r.deleted_at IS NULL
              AND t.deleted_at IS NULL
        """, Integer.class, chemistId, routeId);

        return cnt != null && cnt > 0;
    }

    public Set<Long> findMissingActiveProductIds(Collection<Long> productIds) {
        if (productIds == null || productIds.isEmpty()) return Set.of();

        LinkedHashSet<Long> ids = productIds.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (ids.isEmpty()) return Set.of();

        String in = ids.stream().map(x -> "?").collect(Collectors.joining(","));

        String sql = """
            SELECT id
            FROM products
            WHERE deleted_at IS NULL
              AND id IN (%s)
        """.formatted(in);

        List<Long> found = jdbc.query(sql, (rs, i) -> rs.getLong("id"), ids.toArray());

        Set<Long> missing = new HashSet<>(ids);
        missing.removeAll(new HashSet<>(found));
        return missing;
    }
}
