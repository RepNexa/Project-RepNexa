package com.repnexa.modules.admin.masterdata.repo;

import com.repnexa.modules.admin.masterdata.domain.Chemist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ChemistRepository extends JpaRepository<Chemist, Long> {

    @Query("""
        SELECT c FROM Chemist c
        WHERE c.deletedAt IS NULL
          AND (:q IS NULL OR :q = '' OR LOWER(c.name) LIKE CONCAT(LOWER(:q), '%'))
        ORDER BY c.name
    """)
    List<Chemist> searchActiveByNamePrefix(String q);
}
