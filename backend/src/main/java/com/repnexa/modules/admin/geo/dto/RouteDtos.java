package com.repnexa.modules.admin.geo.dto;

public final class RouteDtos {
  private RouteDtos() {
  }

  public record RouteResponse(
      Long id,
      Long territoryId,
      String territoryCode,
      String territoryName,
      String code,
      String name,
      boolean deleted) {
  }

  public record CreateRouteRequest(
      Long territoryId,
      String code,
      String name) {
  }

  public record PatchRouteRequest(
      Long territoryId,
      String code,
      String name,
      Boolean deleted) {
  }
}
