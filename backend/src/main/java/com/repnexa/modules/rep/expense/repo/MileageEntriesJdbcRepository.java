package com.repnexa.modules.rep.expense.repo;

import com.repnexa.modules.rep.expense.dto.MileageListDtos;
import org.springframework.jdbc.core.RowMapper;
import java.util.List;

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

    public List<MileageListDtos.MileageEntryRow> listByRepUser(long repUserId, int limit) {
        int lim = Math.max(1, Math.min(limit, 200));

        String sql = """
            SELECT id, route_id, entry_date, km
            FROM mileage_entries
            WHERE rep_user_id = ?
            ORDER BY entry_date DESC, id DESC
            LIMIT ?
            """;

        RowMapper<MileageListDtos.MileageEntryRow> rm = (rs, rowNum) -> new MileageListDtos.MileageEntryRow(
                rs.getLong("id"),
                rs.getLong("route_id"),
                rs.getDate("entry_date").toLocalDate(),
                rs.getBigDecimal("km")
        );

        return jdbc.query(sql, rm, repUserId, lim);
    }
}
