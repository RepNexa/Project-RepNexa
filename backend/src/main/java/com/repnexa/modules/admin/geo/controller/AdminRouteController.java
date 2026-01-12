package com.repnexa.modules.admin.geo.controller;

import com.repnexa.modules.admin.geo.dto.RouteDtos;
import com.repnexa.modules.admin.geo.service.AdminGeoService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/routes")
public class AdminRouteController {

    private final AdminGeoService geo;

    public AdminRouteController(AdminGeoService geo) {
        this.geo = geo;
    }

    @GetMapping
    public List<RouteDtos.RouteResponse> list() {
        return geo.listRoutes();
    }

    @PostMapping
    public RouteDtos.RouteResponse create(@RequestBody RouteDtos.CreateRouteRequest req) {
        return geo.createRoute(req);
    }

    @PatchMapping("/{id}")
    public RouteDtos.RouteResponse patch(@PathVariable Long id, @RequestBody RouteDtos.PatchRouteRequest req) {
        return geo.patchRoute(id, req);
    }
}
