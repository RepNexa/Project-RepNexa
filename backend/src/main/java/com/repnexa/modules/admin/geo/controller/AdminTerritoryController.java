package com.repnexa.modules.admin.geo.controller;

import com.repnexa.modules.admin.geo.dto.TerritoryDtos;
import com.repnexa.modules.admin.geo.service.AdminGeoService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/territories")
public class AdminTerritoryController {

  private final AdminGeoService geo;

  public AdminTerritoryController(AdminGeoService geo) {
    this.geo = geo;
  }

  @GetMapping
  public List<TerritoryDtos.TerritoryResponse> list() {
    return geo.listTerritories();
  }

  @PostMapping
  public TerritoryDtos.TerritoryResponse create(@RequestBody TerritoryDtos.CreateTerritoryRequest req) {
    return geo.createTerritory(req);
  }

  @PatchMapping("/{id}")
  public TerritoryDtos.TerritoryResponse patch(@PathVariable Long id,
      @RequestBody TerritoryDtos.PatchTerritoryRequest req) {
    return geo.patchTerritory(id, req);
  }
}
