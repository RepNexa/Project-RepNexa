package com.repnexa.modules.assignments.repo;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DoctorRouteAssignmentsJdbcRepository {

    private final JdbcTemplate jdbc;

    public DoctorRouteAssignmentsJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(long doctorId, long routeId) throws DataIntegrityViolationException {
        jdbc.update("""
            INSERT INTO doctor_routes (doctor_id, route_id)
            VALUES (?, ?)
        """, doctorId, routeId);
    }

    public int delete(long doctorId, long routeId) {
        return jdbc.update("""
            DELETE FROM doctor_routes
            WHERE doctor_id = ? AND route_id = ?
        """, doctorId, routeId);
    }
}
