package com.repnexa.modules.rep.dcr.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public final class DcrSubmissionDtos {
    private DcrSubmissionDtos() {}

    // ---------- Requests ----------
    public record CreateDcrSubmissionRequest(
            Long repRouteAssignmentId,
            LocalDate callDate,
            List<DoctorCallInput> doctorCalls,
            List<MissedDoctorInput> missedDoctors
    ) {}

    public record DoctorCallInput(
            Long doctorId,
            String callType,
            List<Long> productIds,
            String remark
    ) {}

    public record MissedDoctorInput(
            Long doctorId,
            String reason,
            String remark
    ) {}

    // ---------- Responses ----------
    public record CreatedResponse(Long id) {}

    public record SubmissionListItem(
            Long id,
            LocalDate callDate,
            Long repRouteAssignmentId,
            Long routeId,
            String routeName,
            String routeCode,
            String territoryName,
            OffsetDateTime submittedAt,
            int doctorCallCount,
            int missedCount
    ) {}

    public record SubmissionDetails(
            Long id,
            LocalDate callDate,
            Long repRouteAssignmentId,
            Long routeId,
            String routeName,
            String routeCode,
            String territoryName,
            OffsetDateTime submittedAt,
            List<DoctorCallDetails> doctorCalls,
            List<MissedDoctorDetails> missedDoctors
    ) {}

    public record DoctorCallDetails(
            Long id,
            Long doctorId,
            String doctorName,
            String specialty,
            String callType,
            String remark,
            List<ProductItem> products
    ) {}

    public record MissedDoctorDetails(
            Long id,
            Long doctorId,
            String doctorName,
            String specialty,
            String reason,
            String remark
    ) {}

    public record ProductItem(
            Long id,
            String code,
            String name
    ) {}
}
