package com.repnexa.modules.lookup.controller;

import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.repnexa.modules.analytics.company.common.AnalyticsScopeService;

@RestController
@RequestMapping("/api/v1/analytics/lookup")
public class AnalyticsLookupController {

  private final AnalyticsScopeService scopeService;
  private final NamedParameterJdbcTemplate jdbc;

  public AnalyticsLookupController(AnalyticsScopeService scopeService, NamedParameterJdbcTemplate jdbc) {
    this.scopeService = scopeService;
    this.jdbc = jdbc;
  }

  @GetMapping("/doctors")
  public List<LookupItem> doctors(@RequestParam(name = "q", required = false) String q, Authentication auth) {
    String query = q == null ? "" : q.trim();
    List<Long> routeIds = scopeService.resolveEffectiveRouteIds(auth, null, null);
    return jdbc.query(
        """
        select distinct d.id, d.name
        from doctors d
        join doctor_routes dr on dr.doctor_id = d.id
        where dr.route_id in (:routeIds)
          and (:q = '' or lower(d.name) like lower(:qLike))
        order by d.name asc
        limit 20
        """,
        Map.of("routeIds", routeIds, "q", query, "qLike", query + "%"),
        (rs, i) -> new LookupItem(rs.getLong("id"), rs.getString("name"))
    );
  }

  @GetMapping("/reps")
  public List<LookupItem> reps(@RequestParam(name = "q", required = false) String q, Authentication auth) {
    String query = q == null ? "" : q.trim();
    List<Long> routeIds = scopeService.resolveEffectiveRouteIds(auth, null, null);
    return jdbc.query(
        """
        select distinct u.id, u.username
        from users u
        join rep_route_assignments rra on rra.rep_user_id = u.id
        where rra.route_id in (:routeIds)
          and rra.enabled = true
          and rra.start_date <= current_date
          and (rra.end_date is null or rra.end_date >= current_date)
          and (:q = '' or lower(u.username) like lower(:qLike))
        order by u.username asc
        limit 20
        """,
        Map.of("routeIds", routeIds, "q", query, "qLike", query + "%"),
        (rs, i) -> new LookupItem(rs.getLong("id"), rs.getString("username"))
    );
  }

  @GetMapping("/chemists")
  public List<LookupItem> chemists(@RequestParam(name = "q", required = false) String q, Authentication auth) {
    String query = q == null ? "" : q.trim();
    List<Long> routeIds = scopeService.resolveEffectiveRouteIds(auth, null, null);
    // Scope by route ownership/assignment using chemists.route_id (matches schema).
    // NOTE: doctor_calls has NO chemist_id column in current schema.
    return jdbc.query(
        """
        select distinct c.id, c.name
        from chemists c
        where c.deleted_at is null
          and c.route_id in (:routeIds)
          and (:q = '' or lower(c.name) like lower(:qLike))
        order by c.name asc
        limit 20
        """,
        Map.of("routeIds", routeIds, "q", query, "qLike", query + "%"),
        (rs, i) -> new LookupItem(rs.getLong("id"), rs.getString("name"))
    );
  }

  public record LookupItem(long id, String name) {}
}
