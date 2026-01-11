package com.repnexa.modules.assignments.service;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.auth.domain.UserRole;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.assignments.repo.DoctorRouteAssignmentsJdbcRepository;
import com.repnexa.modules.assignments.repo.ScopeJdbcRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        if (actor.role() != UserRole.CM) throw ApiException.forbidden("FORBIDDEN", "Access denied");
        if (req == null || req.doctorId() == null || req.routeId() == null) {
            throw ApiException.badRequest("VALIDATION_ERROR", "doctorId and routeId are required");
        }
        if (!scopeJdbc.isActiveDoctor(req.doctorId())) throw ApiException.notFound("DOCTOR_NOT_FOUND", "Doctor not found");
        if (!scopeJdbc.isActiveRoute(req.routeId())) throw ApiException.notFound("ROUTE_NOT_FOUND", "Route not found");

        try {
            repo.insert(req.doctorId(), req.routeId());
        } catch (DataIntegrityViolationException ex) {
            throw ApiException.conflict("DOCTOR_ROUTE_EXISTS", "Doctor is already mapped to this route");
        }
    }

    @Transactional
    public void remove(RepnexaUserDetails actor, long doctorId, long routeId) {
        if (actor.role() != UserRole.CM) throw ApiException.forbidden("FORBIDDEN", "Access denied");
        // idempotent: 204 even if missing
        repo.delete(doctorId, routeId);
    }
}
