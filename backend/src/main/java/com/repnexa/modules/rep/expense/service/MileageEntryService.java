package com.repnexa.modules.rep.expense.service;

import com.repnexa.modules.rep.expense.dto.MileageListDtos;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import com.repnexa.common.api.ApiException;
import com.repnexa.common.api.ApiFieldError;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.expense.dto.MileageDtos;
import com.repnexa.modules.rep.expense.repo.MileageEntriesJdbcRepository;
import com.repnexa.modules.rep.shared.RepScopeJdbcRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class MileageEntryService {

    private final RepScopeJdbcRepository scope;
    private final MileageEntriesJdbcRepository repo;

    public MileageEntryService(RepScopeJdbcRepository scope, MileageEntriesJdbcRepository repo) {
        this.scope = scope;
        this.repo = repo;
    }

    public List<MileageListDtos.MileageEntryRow> listMyEntries(int limit) {
        long repUserId = currentActorId();
        return repo.listByRepUser(repUserId, limit);
    }

    private long currentActorId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof RepnexaUserDetails u) return u.id();
        throw new IllegalStateException("Expected RepnexaUserDetails principal");
    }

    @Transactional
    public MileageDtos.CreatedResponse create(RepnexaUserDetails actor, MileageDtos.CreateMileageEntryRequest req) {
        if (actor == null) throw ApiException.unauthorized("UNAUTHORIZED", "Not authenticated");
        if (req == null) throw ApiException.badRequest("VALIDATION_ERROR", "Request body is required");

        Long rraId = req.repRouteAssignmentId();
        LocalDate entryDate = req.entryDate();
        Double km = req.km();

        if (rraId == null) throw ApiException.badRequest("VALIDATION_ERROR", "repRouteAssignmentId is required");
        if (entryDate == null) throw ApiException.badRequest("VALIDATION_ERROR", "entryDate is required");
        if (km == null) throw ApiException.badRequest("VALIDATION_ERROR", "km is required");
        if (km <= 0) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Validation failed",
                    List.of(new ApiFieldError("km", "km must be > 0")));
        }

        RepScopeJdbcRepository.MrAssignment asg = scope.getActiveMrAssignment(actor.id(), rraId)
                .orElseThrow(() -> ApiException.forbidden("SCOPE_FORBIDDEN", "repRouteAssignmentId is not assigned to you"));
        long routeId = asg.routeId();

        if (repo.exists(actor.id(), routeId, entryDate)) {
            throw ApiException.conflict("MILEAGE_DUPLICATE", "Mileage already submitted for this route and date",
                    List.of(new ApiFieldError("entryDate", "Duplicate mileage for route/date")));
        }

        long id = repo.insert(actor.id(), rraId, routeId, entryDate, km);
        return new MileageDtos.CreatedResponse(id);
    }
}
