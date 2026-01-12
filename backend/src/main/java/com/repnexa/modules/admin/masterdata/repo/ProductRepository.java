package com.repnexa.modules.admin.masterdata.repo;

import com.repnexa.modules.admin.masterdata.domain.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

    @Query("""
        SELECT p FROM Product p
        WHERE p.deletedAt IS NULL
          AND (:q IS NULL OR :q = '' OR LOWER(p.name) LIKE CONCAT(LOWER(:q), '%') OR LOWER(p.code) LIKE CONCAT(LOWER(:q), '%'))
        ORDER BY p.name
    """)
    List<Product> searchActiveByPrefix(String q);
}
