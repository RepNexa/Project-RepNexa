package com.repnexa.modules.rep.dcr.service;

import com.repnexa.common.api.ApiException;
import com.repnexa.common.api.ApiFieldError;
import com.repnexa.modules.assignments.repo.ScopeJdbcRepository;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.dcr.dto.DcrSubmissionDtos;
import com.repnexa.modules.rep.dcr.repo.DcrSubmissionsJdbcRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

@Service
public class DcrSubmissionService {

    private final ScopeJdbcRepository scope;
    private final DcrSubmissionsJdbcRepository repo;

    public DcrSubmissionService(ScopeJdbcRepository scope, DcrSubmissionsJdbcRepository repo) {
        this.scope = scope;
        this.repo = repo;
    }

    @Transactional
    public DcrSubmissionDtos.CreatedResponse create(RepnexaUserDetails actor,
                                                   DcrSubmissionDtos.CreateDcrSubmissionRequest req,
                                                   String idempotencyKey) {
        if (actor == null) throw ApiException.unauthorized("UNAUTHORIZED", "Not authenticated");
        if (req == null) throw ApiException.badRequest("VALIDATION_ERROR", "Request body is required");

        Long rraId = req.repRouteAssignmentId();
        LocalDate callDate = req.callDate();

        if (rraId == null) throw ApiException.badRequest("VALIDATION_ERROR", "repRouteAssignmentId is required");
        if (callDate == null) throw ApiException.badRequest("VALIDATION_ERROR", "callDate is required");

        // Must belong to MR + active assignment
        ScopeJdbcRepository.MrAssignment asg = scope.getActiveMrAssignment(actor.id(), rraId)
                .orElseThrow(() -> ApiException.forbidden("SCOPE_FORBIDDEN", "repRouteAssignmentId is not assigned to you"));
        long routeId = asg.routeId();

        // Idempotency: same key returns existing submission id for this MR
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<Long> existing = repo.findByIdempotencyKey(actor.id(), idempotencyKey);
            if (existing.isPresent()) return new DcrSubmissionDtos.CreatedResponse(existing.get());
        }

        List<DcrSubmissionDtos.DoctorCallInput> doctorCalls = Optional.ofNullable(req.doctorCalls()).orElse(List.of());
        List<DcrSubmissionDtos.MissedDoctorInput> missed = Optional.ofNullable(req.missedDoctors()).orElse(List.of());

        if (doctorCalls.isEmpty() && missed.isEmpty()) {
            throw ApiException.badRequest("VALIDATION_ERROR", "At least one doctor call or missed doctor is required");
        }

        // Validate + collect ids
        List<ApiFieldError> validationErrors = new ArrayList<>();

        List<Long> callDoctorIds = new ArrayList<>();
        for (int i = 0; i < doctorCalls.size(); i++) {
            var c = doctorCalls.get(i);
            if (c == null || c.doctorId() == null) validationErrors.add(new ApiFieldError("doctorCalls[" + i + "].doctorId", "doctorId is required"));
            if (c == null || isBlank(c.callType())) validationErrors.add(new ApiFieldError("doctorCalls[" + i + "].callType", "callType is required"));
            if (c != null && c.doctorId() != null) callDoctorIds.add(c.doctorId());
        }

        List<Long> missedDoctorIds = new ArrayList<>();
        for (int i = 0; i < missed.size(); i++) {
            var m = missed.get(i);
            if (m == null || m.doctorId() == null) validationErrors.add(new ApiFieldError("missedDoctors[" + i + "].doctorId", "doctorId is required"));
            if (m != null && m.doctorId() != null) missedDoctorIds.add(m.doctorId());
        }

        if (!validationErrors.isEmpty()) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Validation failed", validationErrors);
        }

        // Enforce doctor membership in route (service-level for clean 400) + DB FK is the last-line guardrail
        for (int i = 0; i < callDoctorIds.size(); i++) {
            long doctorId = callDoctorIds.get(i);
            if (!scope.isActiveDoctorInRoute(doctorId, routeId)) {
                throw ApiException.badRequest("VALIDATION_ERROR", "Doctor is not mapped to the selected route",
                        List.of(new ApiFieldError("doctorCalls[" + i + "].doctorId", "Doctor not in route")));
            }
        }
        for (int i = 0; i < missedDoctorIds.size(); i++) {
            long doctorId = missedDoctorIds.get(i);
            if (!scope.isActiveDoctorInRoute(doctorId, routeId)) {
                throw ApiException.badRequest("VALIDATION_ERROR", "Doctor is not mapped to the selected route",
                        List.of(new ApiFieldError("missedDoctors[" + i + "].doctorId", "Doctor not in route")));
            }
        }

        // Product IDs must be active (optional per call)
        for (int i = 0; i < doctorCalls.size(); i++) {
            var c = doctorCalls.get(i);
            List<Long> pids = normalizeIds(c.productIds());
            if (!pids.isEmpty()) {
                Set<Long> missing = scope.findMissingActiveProductIds(pids);
                if (!missing.isEmpty()) {
                    throw ApiException.badRequest("VALIDATION_ERROR", "Invalid productId(s)",
                            List.of(new ApiFieldError("doctorCalls[" + i + "].productIds", "Unknown product(s): " + missing)));
                }
            }
        }

        // Duplicate detection (DB + within request) -> 409 with per-row errors.
        List<ApiFieldError> callDupErrors = duplicateFieldErrors("doctorCalls", callDoctorIds);
        Set<Long> existingCalls = repo.findExistingDoctorCallDoctorIds(actor.id(), callDate, new HashSet<>(callDoctorIds));
        if (!existingCalls.isEmpty()) {
            for (int i = 0; i < doctorCalls.size(); i++) {
                long doctorId = doctorCalls.get(i).doctorId();
                if (existingCalls.contains(doctorId)) {
                    callDupErrors.add(new ApiFieldError("doctorCalls[" + i + "].doctorId", "Duplicate call for this doctor on this date"));
                }
            }
        }
        if (!callDupErrors.isEmpty()) {
            throw ApiException.conflict("DOCTOR_CALL_DUPLICATE", "Duplicate doctor call(s) for the same date", callDupErrors);
        }

        List<ApiFieldError> missedDupErrors = duplicateFieldErrors("missedDoctors", missedDoctorIds);
        Set<Long> existingMissed = repo.findExistingMissedDoctorDoctorIds(actor.id(), callDate, new HashSet<>(missedDoctorIds));
        if (!existingMissed.isEmpty()) {
            for (int i = 0; i < missed.size(); i++) {
                long doctorId = missed.get(i).doctorId();
                if (existingMissed.contains(doctorId)) {
                    missedDupErrors.add(new ApiFieldError("missedDoctors[" + i + "].doctorId", "Duplicate missed doctor for this date"));
                }
            }
        }
        if (!missedDupErrors.isEmpty()) {
            throw ApiException.conflict("MISSED_DOCTOR_DUPLICATE", "Duplicate missed doctor(s) for the same date", missedDupErrors);
        }

        // Persist (immutable): submission -> calls -> products -> missed
        long submissionId = repo.insertSubmission(actor.id(), rraId, callDate, idempotencyKey);

        try {
            for (var c : doctorCalls) {
                long callId = repo.insertDoctorCall(submissionId, actor.id(), routeId, callDate, c.doctorId(), c.callType().trim());
                repo.insertDoctorCallProducts(callId, normalizeIds(c.productIds()));
            }
            for (var m : missed) {
                repo.insertMissedDoctor(submissionId, actor.id(), routeId, callDate, m.doctorId(), trimToNull(m.reason()));
            }
        } catch (DataIntegrityViolationException ex) {
            // Race-condition fallback: DB constraints still enforce uniqueness.
            throw ex;
        }

        return new DcrSubmissionDtos.CreatedResponse(submissionId);
    }

    @Transactional(readOnly = true)
    public List<DcrSubmissionDtos.SubmissionListItem> list(RepnexaUserDetails actor) {
        if (actor == null) throw ApiException.unauthorized("UNAUTHORIZED", "Not authenticated");
        return repo.listSubmissions(actor.id(), 50);
    }

    @Transactional(readOnly = true)
    public DcrSubmissionDtos.SubmissionDetails getById(RepnexaUserDetails actor, long id) {
        if (actor == null) throw ApiException.unauthorized("UNAUTHORIZED", "Not authenticated");
        return repo.getSubmissionDetails(actor.id(), id)
                .orElseThrow(() -> ApiException.notFound("DCR_SUBMISSION_NOT_FOUND", "DCR submission not found"));
    }

    private static boolean isBlank(String s) { return s == null || s.trim().isEmpty(); }
    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
    private static List<Long> normalizeIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        // remove nulls and de-dup while preserving order
        LinkedHashSet<Long> s = new LinkedHashSet<>();
        for (Long x : ids) if (x != null) s.add(x);
        return new ArrayList<>(s);
    }

    private static List<ApiFieldError> duplicateFieldErrors(String prefix, List<Long> ids) {
        Map<Long, Integer> firstIndex = new HashMap<>();
        List<ApiFieldError> errs = new ArrayList<>();
        for (int i = 0; i < ids.size(); i++) {
            Long id = ids.get(i);
            Integer first = firstIndex.putIfAbsent(id, i);
            if (first != null) {
                errs.add(new ApiFieldError(prefix + "[" + first + "].doctorId", "Duplicate in request"));
                errs.add(new ApiFieldError(prefix + "[" + i + "].doctorId", "Duplicate in request"));
            }
        }
        // de-dup identical messages
        LinkedHashMap<String, ApiFieldError> out = new LinkedHashMap<>();
        for (ApiFieldError e : errs) out.put(e.field() + "|" + e.message(), e);
        return new ArrayList<>(out.values());
    }
}
