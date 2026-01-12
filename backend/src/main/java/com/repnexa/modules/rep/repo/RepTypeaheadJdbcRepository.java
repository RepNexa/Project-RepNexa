package com.repnexa.modules.rep.repo;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class RepTypeaheadJdbcRepository {

    private final JdbcTemplate jdbc;

    public RepTypeaheadJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<DoctorItem> doctorsByRoute(long routeId, String q, int limit) {
        String qq = q == null ? "" : q.trim().toLowerCase();
        return jdbc.query("""
            SELECT d.id, d.name, d.specialty
            FROM doctor_routes dr
            JOIN doctors d ON d.id = dr.doctor_id
            WHERE dr.route_id = ?
              AND d.deleted_at IS NULL
              AND (? = '' OR LOWER(d.name) LIKE (? || '%'))
            ORDER BY d.name
            LIMIT ?
        """, (rs, i) -> new DoctorItem(
                rs.getLong("id"),
                rs.getString("name"),
                rs.getString("specialty")
        ), routeId, qq, qq, limit);
    }

    public List<ChemistItem> chemistsByRoute(long routeId, String q, int limit) {
        String qq = q == null ? "" : q.trim().toLowerCase();
        return jdbc.query("""
            SELECT c.id, c.name
            FROM chemists c
            WHERE c.route_id = ?
              AND c.deleted_at IS NULL
              AND (? = '' OR LOWER(c.name) LIKE (? || '%'))
            ORDER BY c.name
            LIMIT ?
        """, (rs, i) -> new ChemistItem(
                rs.getLong("id"),
                rs.getString("name")
        ), routeId, qq, qq, limit);
    }

    public record DoctorItem(long id, String name, String specialty) {}
    public record ChemistItem(long id, String name) {}
}
