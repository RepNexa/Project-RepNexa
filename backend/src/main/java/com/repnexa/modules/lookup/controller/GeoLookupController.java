package com.repnexa.modules.lookup.controller;

import com.repnexa.modules.assignments.repo.ScopeJdbcRepository;
import com.repnexa.modules.auth.domain.UserRole;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/lookup")
public class GeoLookupController {

    private final ScopeJdbcRepository scopeRepo;
    private final NamedParameterJdbcTemplate jdbc;

    public GeoLookupController(ScopeJdbcRepository scopeRepo, NamedParameterJdbcTemplate jdbc) {
        this.scopeRepo = scopeRepo;
        this.jdbc = jdbc;
    }

    @GetMapping("/routes")
    public List<RouteItem> routes(
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "territoryId", required = false) Long territoryId,
            Authentication auth
    ) {
        String query = q == null ? "" : q.trim();
        List<Long> routeIds = resolveAllowedRouteIds(auth);
        if (routeIds.isEmpty()) return List.of();

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("routeIds", routeIds)
                .addValue("territoryId", territoryId) // may be null (OK)
                .addValue("q", query)
                .addValue("qLike", query + "%");

        return jdbc.query("""
                SELECT r.id, r.code, r.name, r.territory_id
                FROM routes r
                JOIN territories t ON t.id = r.territory_id
                WHERE r.deleted_at IS NULL
                  AND t.deleted_at IS NULL
                  AND r.id IN (:routeIds)
                  AND (CAST(:territoryId AS BIGINT) IS NULL OR r.territory_id = CAST(:territoryId AS BIGINT))
                  AND (
                        :q = ''
                        OR LOWER(r.name) LIKE LOWER(:qLike)
                        OR LOWER(r.code) LIKE LOWER(:qLike)
                  )
                ORDER BY r.name ASC
                LIMIT 200
                """,
                params,
                (rs, i) -> new RouteItem(
                        rs.getLong("id"),
                        rs.getString("code"),
                        rs.getString("name"),
                        rs.getLong("territory_id")
                )
        );
    }

    @GetMapping("/territories")
    public List<TerritoryItem> territories(
            @RequestParam(name = "q", required = false) String q,
            Authentication auth
    ) {
        String query = q == null ? "" : q.trim();
        List<Long> routeIds = resolveAllowedRouteIds(auth);
        if (routeIds.isEmpty()) return List.of();

        return jdbc.query("""
                SELECT DISTINCT t.id, t.code, t.name
                FROM territories t
                JOIN routes r ON r.territory_id = t.id
                WHERE t.deleted_at IS NULL
                  AND r.deleted_at IS NULL
                  AND r.id IN (:routeIds)
                  AND (
                        :q = ''
                        OR LOWER(t.name) LIKE LOWER(:qLike)
                        OR LOWER(t.code) LIKE LOWER(:qLike)
                  )
                ORDER BY t.name ASC
                LIMIT 200
                """,
                Map.of(
                        "routeIds", routeIds,
                        "q", query,
                        "qLike", query + "%"
                ),
                (rs, i) -> new TerritoryItem(
                        rs.getLong("id"),
                        rs.getString("code"),
                        rs.getString("name")
                )
        );
    }

    private List<Long> resolveAllowedRouteIds(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof RepnexaUserDetails u)) return List.of();

        UserRole role = u.role();
        long userId = u.id() == null ? -1L : u.id();

        return switch (role) {
            case CM -> scopeRepo.listAllActiveRouteIdsForCm();
            case FM -> scopeRepo.listAllowedRouteIdsForFm(userId);
            case MR -> scopeRepo.listAllowedRouteIdsForMr(userId);
        };
    }

    public record TerritoryItem(long id, String code, String name) {}
    public record RouteItem(long id, String code, String name, long territoryId) {}
}
