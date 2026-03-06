package com.repnexa.modules.admin.masterdata.repo;

import com.repnexa.modules.admin.masterdata.domain.Doctor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DoctorRepository extends JpaRepository<Doctor, Long> {

    @Query("""
                SELECT d FROM Doctor d
                WHERE d.deletedAt IS NULL
                  AND (:q IS NULL OR :q = '' OR LOWER(d.name) LIKE CONCAT(LOWER(:q), '%'))
                ORDER BY d.name
            """)
    List<Doctor> searchActiveByNamePrefix(@Param("q") String q);

    // ✅ NEW: fetch territory names (Location column) using native SQL
    @Query(value = """
                select distinct t.name
                from doctor_routes dr
                join routes r on r.id = dr.route_id and r.deleted_at is null
                join territories t on t.id = r.territory_id and t.deleted_at is null
                where dr.doctor_id = :doctorId
                order by t.name
            """, nativeQuery = true)
    List<String> findTerritoryNamesForDoctor(@Param("doctorId") long doctorId);
}