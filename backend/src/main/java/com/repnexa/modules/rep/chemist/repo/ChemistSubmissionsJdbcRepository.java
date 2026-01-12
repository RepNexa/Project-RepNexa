package com.repnexa.modules.rep.chemist.repo;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public class ChemistSubmissionsJdbcRepository {

    private final JdbcTemplate jdbc;

    public ChemistSubmissionsJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Long> findByIdempotencyKey(long repUserId, String key) {
        if (key == null || key.isBlank()) return Optional.empty();
        List<Long> ids = jdbc.query("""
            SELECT id
            FROM chemist_report_submissions
            WHERE rep_user_id = ? AND idempotency_key = ?
            LIMIT 1
        """, (rs, i) -> rs.getLong("id"), repUserId, key);
        return ids.isEmpty() ? Optional.empty() : Optional.of(ids.get(0));
    }

    public long insertSubmission(long repUserId, long repRouteAssignmentId, LocalDate visitDate, String idempotencyKey) {
        return jdbc.queryForObject("""
            INSERT INTO chemist_report_submissions (rep_user_id, rep_route_assignment_id, visit_date, idempotency_key)
            VALUES (?, ?, ?, ?)
            RETURNING id
        """, Long.class, repUserId, repRouteAssignmentId, visitDate,
                (idempotencyKey == null || idempotencyKey.isBlank()) ? null : idempotencyKey);
    }

    public long insertVisit(long submissionId, long repUserId, long routeId, LocalDate visitDate, long chemistId) {
        return jdbc.queryForObject("""
            INSERT INTO chemist_visits (submission_id, rep_user_id, route_id, visit_date, chemist_id)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id
        """, Long.class, submissionId, repUserId, routeId, visitDate, chemistId);
    }

    public void insertStockFlags(long visitId, List<StockFlagRow> flags) {
        if (flags == null || flags.isEmpty()) return;
        jdbc.batchUpdate("""
            INSERT INTO chemist_stock_flags (visit_id, product_id, status)
            VALUES (?, ?, ?)
        """, flags, 100, (ps, f) -> {
            ps.setLong(1, visitId);
            ps.setLong(2, f.productId());
            ps.setString(3, f.status());
        });
    }

    public record StockFlagRow(long productId, String status) {}
}
