package com.repnexa.modules.assignments.service;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.admin.geo.repo.RouteRepository;
import com.repnexa.modules.admin.geo.repo.TerritoryRepository;
import com.repnexa.modules.assignments.domain.RepRouteAssignment;
import com.repnexa.modules.assignments.dto.RepRouteAssignmentDtos;
import com.repnexa.modules.assignments.repo.RepRouteAssignmentRepository;
import com.repnexa.modules.assignments.repo.ScopeJdbcRepository;
import com.repnexa.modules.auth.domain.UserRole;
import com.repnexa.modules.auth.repo.UserRepository;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
public class AssignmentsService {

    private final RepRouteAssignmentRepository assignments;
    private final UserRepository users;
    private final RouteRepository routes;
    private final TerritoryRepository territories;
    private final ScopeEnforcer scope;
    private final ScopeJdbcRepository scopeJdbc;

    public AssignmentsService(
            RepRouteAssignmentRepository assignments,
            UserRepository users,
            RouteRepository routes,
            TerritoryRepository territories,
            ScopeEnforcer scope,
            ScopeJdbcRepository scopeJdbc
    ) {
        this.assignments = assignments;
        this.users = users;
        this.routes = routes;
        this.territories = territories;
        this.scope = scope;
        this.scopeJdbc = scopeJdbc;
    }

    @Transactional
    public RepRouteAssignmentDtos.RepRouteAssignmentResponse create(RepnexaUserDetails actor, RepRouteAssignmentDtos.CreateRepRouteAssignmentRequest req) {
        if (req == null || isBlank(req.repUsername()) || req.routeId() == null || req.startDate() == null) {
            throw ApiException.badRequest("VALIDATION_ERROR", "repUsername, routeId, startDate are required");
        }
        if (req.endDate() != null && req.endDate().isBefore(req.startDate())) {
            throw ApiException.badRequest("VALIDATION_ERROR", "endDate must be >= startDate");
        }

        // Route must exist and not be deleted; territory must exist and not be deleted
        var route = routes.findById(req.routeId()).orElseThrow(() -> ApiException.notFound("ROUTE_NOT_FOUND", "Route not found"));
        if (route.getDeletedAt() != null) throw ApiException.conflict("ROUTE_DELETED", "Route is deleted");

        var territory = territories.findById(route.getTerritoryId())
                .orElseThrow(() -> ApiException.notFound("TERRITORY_NOT_FOUND", "Territory not found"));
        if (territory.getDeletedAt() != null) throw ApiException.conflict("TERRITORY_DELETED", "Territory is deleted");

        // Scoping: CM ok, FM only within owned territories
        scope.assertCanManageRoute(actor, req.routeId());

        var rep = users.findByUsername(req.repUsername().trim())
                .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "Rep user not found"));
        if (rep.getRole() != UserRole.MR) throw ApiException.badRequest("VALIDATION_ERROR", "repUsername must be an MR user");
        if (!rep.isEnabled()) throw ApiException.conflict("USER_DISABLED", "User is disabled");

        // Overlap guard
        int overlap = scopeJdbc.countOverlappingAssignments(rep.getId(), req.routeId(), req.startDate(), req.endDate(), null);
        if (overlap > 0) throw ApiException.conflict("ASSIGNMENT_OVERLAP", "Overlapping assignment exists for this rep and route");

        RepRouteAssignment a = new RepRouteAssignment();
        a.setRepUserId(rep.getId());
        a.setRouteId(req.routeId());
        a.setAssignedByUserId(actor.id());
        a.setStartDate(req.startDate());
        a.setEndDate(req.endDate());
        a.setEnabled(true);

        RepRouteAssignment saved = assignments.save(a);
        return new RepRouteAssignmentDtos.RepRouteAssignmentResponse(
                saved.getId(),
                saved.getRepUserId(),
                rep.getUsername(),
                saved.getRouteId(),
                saved.getStartDate(),
                saved.getEndDate(),
                saved.isEnabled()
        );
    }

    @Transactional
    public RepRouteAssignmentDtos.RepRouteAssignmentResponse patch(RepnexaUserDetails actor, long id, RepRouteAssignmentDtos.PatchRepRouteAssignmentRequest req) {
        RepRouteAssignment a = assignments.findById(id).orElseThrow(() -> ApiException.notFound("ASSIGNMENT_NOT_FOUND", "Assignment not found"));

        // Scoping: based on assignment route
        scope.assertCanManageRoute(actor, a.getRouteId());

        LocalDate newEnd = req == null ? null : req.endDate();
        Boolean enabled = req == null ? null : req.enabled();

        if (newEnd != null && newEnd.isBefore(a.getStartDate())) {
            throw ApiException.badRequest("VALIDATION_ERROR", "endDate must be >= startDate");
        }

        if (newEnd != null) a.setEndDate(newEnd);
        if (enabled != null) a.setEnabled(enabled);

        // If still enabled, ensure no overlaps created by changing endDate (rare but keep correct)
        if (a.isEnabled()) {
            int overlap = scopeJdbc.countOverlappingAssignments(a.getRepUserId(), a.getRouteId(), a.getStartDate(), a.getEndDate(), a.getId());
            if (overlap > 0) throw ApiException.conflict("ASSIGNMENT_OVERLAP", "Overlapping assignment exists for this rep and route");
        }

        RepRouteAssignment saved = assignments.save(a);
        String repUsername = users.findById(saved.getRepUserId()).map(u -> u.getUsername()).orElse(null);

        return new RepRouteAssignmentDtos.RepRouteAssignmentResponse(
                saved.getId(),
                saved.getRepUserId(),
                repUsername,
                saved.getRouteId(),
                saved.getStartDate(),
                saved.getEndDate(),
                saved.isEnabled()
        );
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
