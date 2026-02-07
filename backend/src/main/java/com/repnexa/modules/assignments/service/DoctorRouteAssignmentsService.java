package com.repnexa.modules.assignments.service;

import com.repnexa.common.api.ApiException;

import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.assignments.repo.DoctorRouteAssignmentsJdbcRepository;
import com.repnexa.modules.assignments.repo.ScopeJdbcRepository;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.SQLException;

@Service
public class DoctorRouteAssignmentsService {

    private final DoctorRouteAssignmentsJdbcRepository repo;
    private final ScopeJdbcRepository scopeJdbc;

    public DoctorRouteAssignmentsService(DoctorRouteAssignmentsJdbcRepository repo, ScopeJdbcRepository scopeJdbc) {
        this.repo = repo;
        this.scopeJdbc = scopeJdbc;
    }

    public record CreateDoctorRouteRequest(Long doctorId, Long routeId) {}

    @Transactional
    public void add(RepnexaUserDetails actor, CreateDoctorRouteRequest req) {
        if (req == null || req.doctorId() == null || req.routeId() == null) {
            throw ApiException.badRequest("VALIDATION_ERROR", "doctorId and routeId are required");
        }
        if (!scopeJdbc.isActiveDoctor(req.doctorId())) throw ApiException.notFound("DOCTOR_NOT_FOUND", "Doctor not found");
        if (!scopeJdbc.isActiveRoute(req.routeId())) throw ApiException.notFound("ROUTE_NOT_FOUND", "Route not found");

        try {
            repo.insert(req.doctorId(), req.routeId());
        } catch (DataIntegrityViolationException ex) {
            if (isDoctorRouteDuplicate(ex)) {
                throw ApiException.conflict("DOCTOR_ROUTE_EXISTS", "Doctor is already mapped to this route");
            }
            throw ex;
        }
    }

    @Transactional
    public void remove(RepnexaUserDetails actor, long doctorId, long routeId) {
        // idempotent: 204 even if missing
        repo.delete(doctorId, routeId);
    }

    private static boolean isDoctorRouteDuplicate(DataIntegrityViolationException ex) {
        SQLException sqlEx = findSqlException(ex);
        if (sqlEx == null) return false;
        if (!"23505".equals(sqlEx.getSQLState())) return false; // unique violation (PostgreSQL)

        String msg = sqlEx.getMessage();
        return msg != null && msg.toLowerCase().contains("doctor_routes_pkey");
    }

    private static SQLException findSqlException(Throwable ex) {
        Throwable root = NestedExceptionUtils.getMostSpecificCause(ex);
        if (root instanceof SQLException sqlEx) return sqlEx;

        Throwable cur = ex;
        while (cur != null) {
            if (cur instanceof SQLException s) return s;
            cur = cur.getCause();
        }
        return null;
    }
}
