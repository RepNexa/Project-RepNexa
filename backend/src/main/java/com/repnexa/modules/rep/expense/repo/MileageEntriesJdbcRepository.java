package com.repnexa.modules.rep.expense.repo;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;

@Repository
public class MileageEntriesJdbcRepository {

    private final JdbcTemplate jdbc;

    public MileageEntriesJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean exists(long repUserId, long routeId, LocalDate entryDate) {
        Integer cnt = jdbc.queryForObject("""
            SELECT COUNT(*)
            FROM mileage_entries
            WHERE rep_user_id = ? AND route_id = ? AND entry_date = ?
        """, Integer.class, repUserId, routeId, entryDate);
        return cnt != null && cnt > 0;
    }

    public long insert(long repUserId, long repRouteAssignmentId, long routeId, LocalDate entryDate, double km) {
        return jdbc.queryForObject("""
            INSERT INTO mileage_entries (rep_user_id, rep_route_assignment_id, route_id, entry_date, km)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id
        """, Long.class, repUserId, repRouteAssignmentId, routeId, entryDate, km);
    }
}
