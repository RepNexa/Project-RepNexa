package com.repnexa.modules.admin.geo.repo;

import com.repnexa.modules.admin.geo.domain.Territory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TerritoryRepository extends JpaRepository<Territory, Long> {
    List<Territory> findByDeletedAtIsNullOrderByNameAsc();
}
