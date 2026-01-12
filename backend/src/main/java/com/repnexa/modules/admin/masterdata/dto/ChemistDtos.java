package com.repnexa.modules.admin.masterdata.dto;

public final class ChemistDtos {
    private ChemistDtos() {}

    public record ChemistResponse(Long id, Long routeId, String name, boolean deleted) {}
    public record CreateChemistRequest(Long routeId, String name) {}
    public record PatchChemistRequest(Long routeId, String name, Boolean deleted) {}
}
