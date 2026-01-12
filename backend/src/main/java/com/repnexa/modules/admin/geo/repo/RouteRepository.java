package com.repnexa.modules.admin.geo.repo;

import com.repnexa.modules.admin.geo.domain.Route;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RouteRepository extends JpaRepository<Route, Long> {
    List<Route> findByDeletedAtIsNullOrderByNameAsc();
    List<Route> findByTerritoryIdAndDeletedAtIsNullOrderByNameAsc(Long territoryId);
}
