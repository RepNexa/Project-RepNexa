package com.repnexa.modules.rep.todo.repo;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public class RepTodoJdbcRepository {

    private final JdbcTemplate jdbc;

    public RepTodoJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record DoctorAgg(
            long doctorId,
            String doctorName,
            String grade,
           int visitsThisMonth,
            LocalDate lastVisitDate,
            int sprintVisits
    ) {}

    public List<DoctorAgg> fetchDoctorAggs(long repUserId,
                                         long routeId,
                                          LocalDate monthStart,
                                         LocalDate monthEndExclusive,
                                         LocalDate sprintStart,
                                          LocalDate sprintEnd) {
       return jdbc.query("""
           SELECT
                d.id AS doctor_id,
               d.name AS doctor_name,
               COALESCE(d.grade, 'C') AS grade,
               COALESCE(m.visits_this_month, 0) AS visits_this_month,
               lv.last_visit_date,
                COALESCE(s.sprint_visits, 0) AS sprint_visits
            FROM doctor_routes dr
            JOIN doctors d ON d.id = dr.doctor_id AND d.deleted_at IS NULL AND d.status = 'ACTIVE'
           JOIN routes r ON r.id = dr.route_id AND r.deleted_at IS NULL
           JOIN territories t ON t.id = r.territory_id AND t.deleted_at IS NULL
            LEFT JOIN (
               SELECT doctor_id, COUNT(*) AS visits_this_month
                FROM doctor_calls
               WHERE rep_user_id = ?
                  AND route_id = ?
                  AND call_date >= ?
                 AND call_date < ?
                GROUP BY doctor_id
            ) m ON m.doctor_id = d.id
            LEFT JOIN (
                SELECT doctor_id, MAX(call_date) AS last_visit_date
                FROM doctor_calls
                WHERE rep_user_id = ?
                 AND route_id = ?
                GROUP BY doctor_id
           ) lv ON lv.doctor_id = d.id
            LEFT JOIN (
                SELECT doctor_id, COUNT(*) AS sprint_visits
                FROM doctor_calls
                WHERE rep_user_id = ?
                  AND route_id = ?
                  AND call_date >= ?
                  AND call_date <= ?
                GROUP BY doctor_id
            ) s ON s.doctor_id = d.id
            WHERE dr.route_id = ?
            ORDER BY lower(d.name)
        """, (rs, i) -> new DoctorAgg(
                rs.getLong("doctor_id"),
               rs.getString("doctor_name"),
                rs.getString("grade"),
                rs.getInt("visits_this_month"),
                rs.getObject("last_visit_date", LocalDate.class),
                rs.getInt("sprint_visits")
        ),
                repUserId, routeId, monthStart, monthEndExclusive,
                repUserId, routeId,
                repUserId, routeId, sprintStart, sprintEnd,
                routeId
        );
    }
}