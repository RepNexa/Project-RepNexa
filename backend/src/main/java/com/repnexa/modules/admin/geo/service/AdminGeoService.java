package com.repnexa.modules.admin.geo.service;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.admin.geo.domain.Route;
import com.repnexa.modules.admin.geo.domain.Territory;
import com.repnexa.modules.admin.geo.dto.RouteDtos;
import com.repnexa.modules.admin.geo.dto.TerritoryDtos;
import com.repnexa.modules.admin.geo.repo.RouteRepository;
import com.repnexa.modules.admin.geo.repo.TerritoryRepository;
import com.repnexa.modules.auth.repo.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AdminGeoService {

  private final TerritoryRepository territories;
  private final RouteRepository routes;
  private final UserRepository users;

  public AdminGeoService(TerritoryRepository territories, RouteRepository routes, UserRepository users) {
    this.territories = territories;
    this.routes = routes;
    this.users = users;
  }

  @Transactional(readOnly = true)
  public List<TerritoryDtos.TerritoryResponse> listTerritories() {
    return territories.findByDeletedAtIsNullOrderByNameAsc().stream()
        .map(t -> {
          String ownerUsername = null;
          if (t.getOwnerUserId() != null) {
            ownerUsername = users.findById(t.getOwnerUserId()).map(u -> u.getUsername()).orElse(null);
          }
          return new TerritoryDtos.TerritoryResponse(
              t.getId(),
              t.getCode(),
              t.getName(),
              t.getOwnerUserId(),
              ownerUsername,
              t.getDeletedAt() != null);
        })
        .toList();
  }

  @Transactional
  public TerritoryDtos.TerritoryResponse createTerritory(TerritoryDtos.CreateTerritoryRequest req) {
    if (req == null || isBlank(req.code()) || isBlank(req.name())) {
      throw ApiException.badRequest("VALIDATION_ERROR", "code and name are required");
    }

    Territory t = new Territory();
    t.setCode(req.code().trim().toUpperCase());
    t.setName(req.name().trim());

    if (!isBlank(req.ownerUsername())) {
      Long ownerId = users.findByUsername(req.ownerUsername().trim())
          .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "Owner user not found"))
          .getId();
      t.setOwnerUserId(ownerId);
    }

    Territory saved = territories.save(t);

    String ownerUsername = saved.getOwnerUserId() == null ? null
        : users.findById(saved.getOwnerUserId()).map(u -> u.getUsername()).orElse(null);

    return new TerritoryDtos.TerritoryResponse(saved.getId(), saved.getCode(), saved.getName(),
        saved.getOwnerUserId(), ownerUsername, saved.getDeletedAt() != null);
  }

  @Transactional
  public TerritoryDtos.TerritoryResponse patchTerritory(Long id, TerritoryDtos.PatchTerritoryRequest req) {
    Territory t = territories.findById(id)
        .orElseThrow(() -> ApiException.notFound("TERRITORY_NOT_FOUND", "Territory not found"));
    if (t.getDeletedAt() != null)
      throw ApiException.conflict("TERRITORY_DELETED", "Territory is deleted");

    if (req != null) {
      if (!isBlank(req.code()))
        t.setCode(req.code().trim().toUpperCase());
      if (!isBlank(req.name()))
        t.setName(req.name().trim());

      if (req.ownerUsername() != null) {
        if (isBlank(req.ownerUsername())) {
          t.setOwnerUserId(null);
        } else {
          Long ownerId = users.findByUsername(req.ownerUsername().trim())
              .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "Owner user not found"))
              .getId();
          t.setOwnerUserId(ownerId);
        }
      }

      if (Boolean.TRUE.equals(req.deleted())) {
        t.softDeleteNow();
      }
    }

    Territory saved = territories.save(t);
    String ownerUsername = saved.getOwnerUserId() == null ? null
        : users.findById(saved.getOwnerUserId()).map(u -> u.getUsername()).orElse(null);

    return new TerritoryDtos.TerritoryResponse(saved.getId(), saved.getCode(), saved.getName(),
        saved.getOwnerUserId(), ownerUsername, saved.getDeletedAt() != null);
  }

  @Transactional(readOnly = true)
  public List<RouteDtos.RouteResponse> listRoutes() {
    return routes.findByDeletedAtIsNullOrderByNameAsc().stream()
        .map(r -> {
          Territory t = territories.findById(r.getTerritoryId())
              .orElseThrow(() -> ApiException.notFound("TERRITORY_NOT_FOUND", "Territory not found"));
          return new RouteDtos.RouteResponse(
              r.getId(),
              r.getTerritoryId(),
              t.getCode(),
              t.getName(),
              r.getCode(),
              r.getName(),
              r.getDeletedAt() != null);
        })
        .toList();
  }

  @Transactional
  public RouteDtos.RouteResponse createRoute(RouteDtos.CreateRouteRequest req) {
    if (req == null || req.territoryId() == null || isBlank(req.code()) || isBlank(req.name())) {
      throw ApiException.badRequest("VALIDATION_ERROR", "territoryId, code, name are required");
    }

    Territory t = territories.findById(req.territoryId())
        .orElseThrow(() -> ApiException.notFound("TERRITORY_NOT_FOUND", "Territory not found"));
    if (t.getDeletedAt() != null)
      throw ApiException.conflict("TERRITORY_DELETED", "Territory is deleted");

    Route r = new Route();
    r.setTerritoryId(req.territoryId());
    r.setCode(req.code().trim().toUpperCase());
    r.setName(req.name().trim());

    Route saved = routes.save(r);
    return new RouteDtos.RouteResponse(saved.getId(), saved.getTerritoryId(), t.getCode(), t.getName(),
        saved.getCode(), saved.getName(), saved.getDeletedAt() != null);
  }

  @Transactional
  public RouteDtos.RouteResponse patchRoute(Long id, RouteDtos.PatchRouteRequest req) {
    Route r = routes.findById(id).orElseThrow(() -> ApiException.notFound("ROUTE_NOT_FOUND", "Route not found"));
    if (r.getDeletedAt() != null)
      throw ApiException.conflict("ROUTE_DELETED", "Route is deleted");

    if (req != null) {
      if (req.territoryId() != null) {
        Territory newT = territories.findById(req.territoryId())
            .orElseThrow(() -> ApiException.notFound("TERRITORY_NOT_FOUND", "Territory not found"));
        if (newT.getDeletedAt() != null)
          throw ApiException.conflict("TERRITORY_DELETED", "Territory is deleted");
        r.setTerritoryId(req.territoryId());
      }
      if (!isBlank(req.code()))
        r.setCode(req.code().trim().toUpperCase());
      if (!isBlank(req.name()))
        r.setName(req.name().trim());
      if (Boolean.TRUE.equals(req.deleted()))
        r.softDeleteNow();
    }

    Route saved = routes.save(r);
    Territory t = territories.findById(saved.getTerritoryId())
        .orElseThrow(() -> ApiException.notFound("TERRITORY_NOT_FOUND", "Territory not found"));

    return new RouteDtos.RouteResponse(saved.getId(), saved.getTerritoryId(), t.getCode(), t.getName(),
        saved.getCode(), saved.getName(), saved.getDeletedAt() != null);
  }

  private boolean isBlank(String s) {
    return s == null || s.trim().isEmpty();
  }
}
