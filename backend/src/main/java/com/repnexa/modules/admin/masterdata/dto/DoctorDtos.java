package com.repnexa.modules.admin.masterdata.dto;

public final class DoctorDtos {
    private DoctorDtos() {}

    public record DoctorResponse(Long id, String name, String specialty, boolean deleted) {}
    public record CreateDoctorRequest(String name, String specialty) {}
    public record PatchDoctorRequest(String name, String specialty, Boolean deleted) {}
}
