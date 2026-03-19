package com.repnexa.modules.rep.alerts.repo;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public class RepAlertsJdbcRepository {

    private final JdbcTemplate jdbc;

    public RepAlertsJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<AlertRow> fetchRecentMasterDataChanges(long routeId, OffsetDateTime cutoff, int limit) {
        return jdbc.query("""
            SELECT entity_type, entity_id, title, change_kind, changed_at, subtitle
            FROM (
                SELECT
                    'DOCTOR' AS entity_type,
                    d.id AS entity_id,
                    d.name AS title,
                    CASE
                        WHEN d.deleted_at IS NOT NULL THEN 'DELETED'
                        WHEN d.status = 'RETIRED' THEN 'RETIRED'
                        WHEN d.updated_at = d.created_at THEN 'ADDED'
                        ELSE 'UPDATED'
                    END AS change_kind,
                    d.updated_at AS changed_at,
                    COALESCE(d.grade, 'C') AS subtitle
                FROM doctor_routes dr
                JOIN doctors d ON d.id = dr.doctor_id
                WHERE dr.route_id = ?
                  AND d.updated_at >= ?

                UNION ALL

                SELECT
                    'CHEMIST' AS entity_type,
                    c.id AS entity_id,
                    c.name AS title,
                    CASE
                        WHEN c.deleted_at IS NOT NULL THEN 'DELETED'
                        WHEN c.updated_at = c.created_at THEN 'ADDED'
                        ELSE 'UPDATED'
                    END AS change_kind,
                    c.updated_at AS changed_at,
                    r.code AS subtitle
                FROM chemists c
                JOIN routes r ON r.id = c.route_id
                WHERE c.route_id = ?
                  AND c.updated_at >= ?

                UNION ALL

                SELECT
                    'PRODUCT' AS entity_type,
                    p.id AS entity_id,
                    CASE
                        WHEN COALESCE(NULLIF(trim(p.code), ''), '') <> '' THEN p.code || ' — ' || p.name
                        ELSE p.name
                    END AS title,
                    CASE
                        WHEN p.deleted_at IS NOT NULL THEN 'DELETED'
                        WHEN p.updated_at = p.created_at THEN 'ADDED'
                        ELSE 'UPDATED'
                    END AS change_kind,
                    p.updated_at AS changed_at,
                    p.code AS subtitle
                FROM products p
                WHERE p.updated_at >= ?
            ) x
            ORDER BY changed_at DESC, entity_type ASC, entity_id DESC
            LIMIT ?
        """, (rs, i) -> new AlertRow(
                rs.getString("entity_type"),
                rs.getLong("entity_id"),
                rs.getString("title"),
                rs.getString("change_kind"),
                rs.getObject("changed_at", OffsetDateTime.class),
                rs.getString("subtitle")
        ), routeId, cutoff, routeId, cutoff, cutoff, limit);
    }

    public record AlertRow(
            String entityType,
            long entityId,
            String title,
            String changeKind,
            OffsetDateTime changedAt,
            String subtitle
    ) {}
}