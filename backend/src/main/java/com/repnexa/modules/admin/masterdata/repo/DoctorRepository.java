package com.repnexa.modules.admin.masterdata.repo;

import com.repnexa.modules.admin.masterdata.domain.Doctor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface DoctorRepository extends JpaRepository<Doctor, Long> {

    @Query("""
        SELECT d FROM Doctor d
        WHERE d.deletedAt IS NULL
          AND (:q IS NULL OR :q = '' OR LOWER(d.name) LIKE CONCAT(LOWER(:q), '%'))
        ORDER BY d.name
    """)
    List<Doctor> searchActiveByNamePrefix(String q);
}
