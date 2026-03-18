package com.repnexa.modules.admin.masterdata.dto;

import java.util.List;

public final class DoctorDtos {
    private DoctorDtos() {
    }

    // ✅ added List<String> locations
    public record DoctorResponse(
            Long id,
            String name,
            String specialty,
            String grade,
            String status,
            boolean deleted,
            List<String> locations,
            String primaryRep,
            String secondaryRep,
            String lastUpdated) {
    }

    public record CreateDoctorRequest(String name, String specialty, String grade, String status) {
    }

    public record PatchDoctorRequest(String name, String specialty, String grade, String status, Boolean deleted) {
    }
}