package com.repnexa.modules.admin.geo.dto;

public final class TerritoryDtos {
    private TerritoryDtos() {}

    public record TerritoryResponse(
            Long id,
            String code,
            String name,
            Long ownerUserId,
            String ownerUsername,
            boolean deleted
    ) {}

    public record CreateTerritoryRequest(
            String code,
            String name,
            String ownerUsername
    ) {}

    public record PatchTerritoryRequest(
            String code,
            String name,
            String ownerUsername,
            Boolean deleted
    ) {}
}
