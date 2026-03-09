package com.repnexa.modules.rep.chemist.service;

import com.repnexa.common.api.ApiException;
import com.repnexa.common.api.ApiFieldError;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.chemist.dto.ChemistSubmissionDtos;
import com.repnexa.modules.rep.chemist.repo.ChemistSubmissionsJdbcRepository;
import com.repnexa.modules.rep.shared.RepScopeJdbcRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.repnexa.modules.rep.chemist.dto.ChemistSubmissionListDtos;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import java.time.LocalDate;
import java.util.*;

@Service
public class ChemistSubmissionService {

    private final RepScopeJdbcRepository scope;
    private final ChemistSubmissionsJdbcRepository repo;

    public ChemistSubmissionService(RepScopeJdbcRepository scope, ChemistSubmissionsJdbcRepository repo) {
        this.scope = scope;
        this.repo = repo;
    }

    @Transactional
    public ChemistSubmissionDtos.CreatedResponse create(
            RepnexaUserDetails actor,
            ChemistSubmissionDtos.CreateChemistSubmissionRequest req,
            String idempotencyKey
    ) {
        if (actor == null) throw ApiException.unauthorized("UNAUTHORIZED", "Not authenticated");
        if (req == null) throw ApiException.badRequest("VALIDATION_ERROR", "Request body is required");

        Long rraId = req.repRouteAssignmentId();
        LocalDate visitDate = req.visitDate();
        if (rraId == null) throw ApiException.badRequest("VALIDATION_ERROR", "repRouteAssignmentId is required");
        if (visitDate == null) throw ApiException.badRequest("VALIDATION_ERROR", "visitDate is required");

        RepScopeJdbcRepository.MrAssignment asg = scope.getActiveMrAssignment(actor.id(), rraId)
                .orElseThrow(() -> ApiException.forbidden("SCOPE_FORBIDDEN", "repRouteAssignmentId is not assigned to you"));
        long routeId = asg.routeId();

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<Long> existing = repo.findByIdempotencyKey(actor.id(), idempotencyKey);
            if (existing.isPresent()) return new ChemistSubmissionDtos.CreatedResponse(existing.get());
        }

        List<ChemistSubmissionDtos.ChemistVisitInput> visits = Optional.ofNullable(req.visits()).orElse(List.of());
        if (visits.isEmpty()) {
            throw ApiException.badRequest("VALIDATION_ERROR", "At least one chemist visit is required");
        }

        List<ApiFieldError> validation = new ArrayList<>();
        List<ApiFieldError> duplicates = new ArrayList<>();

        // Collect product ids for existence check
        List<Long> allProductIds = new ArrayList<>();

        for (int i = 0; i < visits.size(); i++) {
            var v = visits.get(i);
            if (v == null || v.chemistId() == null) {
                validation.add(new ApiFieldError("visits[" + i + "].chemistId", "chemistId is required"));
                continue;
            }

            if (!scope.isActiveChemistInRoute(v.chemistId(), routeId)) {
                validation.add(new ApiFieldError("visits[" + i + "].chemistId", "Chemist not in route"));
            }

            List<ChemistSubmissionDtos.StockFlagInput> flags = Optional.ofNullable(v.stockFlags()).orElse(List.of());
            if (flags.isEmpty()) {
                validation.add(new ApiFieldError("visits[" + i + "].stockFlags", "At least one stock flag is required"));
                continue;
            }

            // Enforce UNIQUE(product) within each visit request -> 409 STOCK_FLAG_DUPLICATE
            Map<Long, Integer> firstIdx = new HashMap<>();
            for (int j = 0; j < flags.size(); j++) {
                var f = flags.get(j);
                String base = "visits[" + i + "].stockFlags[" + j + "]";
                if (f == null || f.productId() == null) {
                    validation.add(new ApiFieldError(base + ".productId", "productId is required"));
                    continue;
                }
                if (f.status() == null || f.status().trim().isEmpty()) {
                    validation.add(new ApiFieldError(base + ".status", "status is required"));
                } else {
                    String s = f.status().trim().toUpperCase(Locale.ROOT);
                    if (!s.equals("OOS") && !s.equals("LOW")) {
                        validation.add(new ApiFieldError(base + ".status", "status must be OOS or LOW"));
                    }
                }

                allProductIds.add(f.productId());

                Integer prior = firstIdx.putIfAbsent(f.productId(), j);
                if (prior != null) {
                    duplicates.add(new ApiFieldError("visits[" + i + "].stockFlags[" + prior + "].productId", "Duplicate product in same visit"));
                    duplicates.add(new ApiFieldError(base + ".productId", "Duplicate product in same visit"));
                }
            }
        }

        if (!validation.isEmpty()) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Validation failed", validation);
        }

        if (!duplicates.isEmpty()) {
            throw ApiException.conflict("STOCK_FLAG_DUPLICATE", "Duplicate stock flag product(s) in the same visit", dedupe(duplicates));
        }

        // Product existence (soft delete enforced here)
        Set<Long> missing = scope.findMissingActiveProductIds(allProductIds);
        if (!missing.isEmpty()) {
            // Mark rows that reference missing products
            List<ApiFieldError> errs = new ArrayList<>();
            for (int i = 0; i < visits.size(); i++) {
                var v = visits.get(i);
                if (v == null) continue;
                List<ChemistSubmissionDtos.StockFlagInput> flags = Optional.ofNullable(v.stockFlags()).orElse(List.of());
                for (int j = 0; j < flags.size(); j++) {
                    var f = flags.get(j);
                    if (f != null && f.productId() != null && missing.contains(f.productId())) {
                        errs.add(new ApiFieldError("visits[" + i + "].stockFlags[" + j + "].productId", "Unknown or inactive product"));
                    }
                }
            }
            throw ApiException.badRequest("VALIDATION_ERROR", "Invalid productId(s)", dedupe(errs));
        }

        long submissionId = repo.insertSubmission(actor.id(), rraId, visitDate, idempotencyKey);

        for (var v : visits) {
            long visitId = repo.insertVisit(submissionId, actor.id(), routeId, visitDate, v.chemistId());

            List<ChemistSubmissionsJdbcRepository.StockFlagRow> rows = Optional.ofNullable(v.stockFlags()).orElse(List.of()).stream()
                    .filter(Objects::nonNull)
                    .map(f -> new ChemistSubmissionsJdbcRepository.StockFlagRow(
                            f.productId(),
                            f.status().trim().toUpperCase(Locale.ROOT)
                    ))
                    .toList();

            repo.insertStockFlags(visitId, rows);
        }

        return new ChemistSubmissionDtos.CreatedResponse(submissionId);
    }

    private static List<ApiFieldError> dedupe(List<ApiFieldError> in) {
        LinkedHashMap<String, ApiFieldError> m = new LinkedHashMap<>();
        for (ApiFieldError e : in) m.put(e.field() + "|" + e.message(), e);
        return new ArrayList<>(m.values());
    }

    public List<ChemistSubmissionListDtos.ChemistSubmissionRow> listMySubmissions(int limit) {
        long repUserId = currentActorId();
        return repo.listByRepUser(repUserId, limit);
    }

    private long currentActorId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof RepnexaUserDetails u) return u.id();
        throw new IllegalStateException("Expected RepnexaUserDetails principal");
    }

}
