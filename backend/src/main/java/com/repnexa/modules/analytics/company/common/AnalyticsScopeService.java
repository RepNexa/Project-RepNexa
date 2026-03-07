package com.repnexa.modules.analytics.company.common;

import com.repnexa.common.api.ApiException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;

@Service
public class AnalyticsScopeService {

  private final NamedParameterJdbcTemplate jdbc;

  public AnalyticsScopeService(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  /**
   * Resolves the effective route scope for analytics endpoints.
   *
   * Rules (same intent as Milestone 6):
   * - CM: requestedRouteIds if provided; otherwise all non-deleted routes.
   * - CM w/ fieldManagerId: routes belonging to that FM (territories.owner_user_id = fieldManagerId),
   *   intersected with requestedRouteIds if provided.
   * - FM: routes belonging to FM (territories.owner_user_id = current user id),
   *   intersected with requestedRouteIds if provided.
   */
  @Transactional(readOnly = true)
  public List<Long> resolveEffectiveRouteIds(Authentication auth, List<Long> requestedRouteIds, Long fieldManagerId) {
    if (auth == null) {
      throw new ApiException(401, "AUTH_REQUIRED", "Authentication required");
    }

    boolean isCm = hasRole(auth, "ROLE_CM");
    boolean isFm = hasRole(auth, "ROLE_FM");
    if (!isCm && !isFm) {
      // analytics endpoints should already be RBAC protected, but keep it defensive
      throw new ApiException(403, "RBAC_FORBIDDEN", "Not permitted");
    }

    Long actorUserId = jdbc.query(
        "select id from users where username = :u",
        java.util.Map.of("u", auth.getName()),
        rs -> rs.next() ? rs.getLong(1) : null
    );
    if (actorUserId == null) {
      throw new ApiException(401, "AUTH_REQUIRED", "Unknown user");
    }

    List<Long> baseScope;
    if (isFm || (isCm && fieldManagerId != null)) {
      long fmUserId = isFm ? actorUserId : fieldManagerId;
      baseScope = jdbc.queryForList(
          """
          select r.id
          from routes r
          join territories t on t.id = r.territory_id
          where r.deleted_at is null
            and t.deleted_at is null
            and t.owner_user_id = :fmUserId
          """,
          java.util.Map.of("fmUserId", fmUserId),
          Long.class
      );
    } else {
      // CM without fieldManagerId
      baseScope = jdbc.queryForList(
          "select r.id from routes r where r.deleted_at is null",
          java.util.Collections.emptyMap(),
          Long.class
      );
    }

    List<Long> effective = intersectOrAll(baseScope, requestedRouteIds);
    if (effective.isEmpty()) {
      throw new ApiException(403, "SCOPE_FORBIDDEN", "No effective routes in scope");
    }
    return effective;
  }

  private static boolean hasRole(Authentication auth, String role) {
    for (GrantedAuthority a : auth.getAuthorities()) {
      if (role.equals(a.getAuthority())) return true;
    }
    return false;
  }

  private static List<Long> intersectOrAll(List<Long> baseScope, List<Long> requested) {
    if (requested == null || requested.isEmpty()) {
      return new ArrayList<>(baseScope);
    }
    Set<Long> base = new HashSet<>(baseScope);
    List<Long> out = new ArrayList<>();
    for (Long r : requested) {
      if (r != null && base.contains(r)) out.add(r);
    }
    return out;
  }
}