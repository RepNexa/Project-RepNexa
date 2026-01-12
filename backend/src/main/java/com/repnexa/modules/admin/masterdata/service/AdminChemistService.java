package com.repnexa.modules.admin.masterdata.service;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.admin.geo.repo.RouteRepository;
import com.repnexa.modules.admin.masterdata.domain.Chemist;
import com.repnexa.modules.admin.masterdata.dto.ChemistDtos;
import com.repnexa.modules.admin.masterdata.repo.ChemistRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AdminChemistService {

    private final ChemistRepository chemists;
    private final RouteRepository routes;

    public AdminChemistService(ChemistRepository chemists, RouteRepository routes) {
        this.chemists = chemists;
        this.routes = routes;
    }

    @Transactional(readOnly = true)
    public List<ChemistDtos.ChemistResponse> list(String q) {
        return chemists.searchActiveByNamePrefix(trimToNull(q)).stream()
                .map(c -> new ChemistDtos.ChemistResponse(c.getId(), c.getRouteId(), c.getName(), c.getDeletedAt() != null))
                .toList();
    }

    @Transactional
    public ChemistDtos.ChemistResponse create(ChemistDtos.CreateChemistRequest req) {
        if (req == null || req.routeId() == null || isBlank(req.name())) {
            throw ApiException.badRequest("VALIDATION_ERROR", "routeId and name are required");
        }
        var r = routes.findById(req.routeId()).orElseThrow(() -> ApiException.notFound("ROUTE_NOT_FOUND", "Route not found"));
        if (r.getDeletedAt() != null) throw ApiException.conflict("ROUTE_DELETED", "Route is deleted");

        Chemist c = new Chemist();
        c.setRouteId(req.routeId());
        c.setName(req.name().trim());
        Chemist saved = chemists.save(c);

        return new ChemistDtos.ChemistResponse(saved.getId(), saved.getRouteId(), saved.getName(), false);
    }

    @Transactional
    public ChemistDtos.ChemistResponse patch(long id, ChemistDtos.PatchChemistRequest req) {
        Chemist c = chemists.findById(id).orElseThrow(() -> ApiException.notFound("CHEMIST_NOT_FOUND", "Chemist not found"));
        if (c.getDeletedAt() != null) throw ApiException.conflict("CHEMIST_DELETED", "Chemist is deleted");

        if (req != null) {
            if (req.routeId() != null) {
                var r = routes.findById(req.routeId()).orElseThrow(() -> ApiException.notFound("ROUTE_NOT_FOUND", "Route not found"));
                if (r.getDeletedAt() != null) throw ApiException.conflict("ROUTE_DELETED", "Route is deleted");
                c.setRouteId(req.routeId());
            }
            if (!isBlank(req.name())) c.setName(req.name().trim());
            if (Boolean.TRUE.equals(req.deleted())) c.softDeleteNow();
        }

        Chemist saved = chemists.save(c);
        return new ChemistDtos.ChemistResponse(saved.getId(), saved.getRouteId(), saved.getName(), saved.getDeletedAt() != null);
    }

    private static boolean isBlank(String s) { return s == null || s.trim().isEmpty(); }
    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
