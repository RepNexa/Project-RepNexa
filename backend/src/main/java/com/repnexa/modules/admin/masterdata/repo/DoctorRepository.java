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

    // ✅ NEW: Primary rep username for this doctor (based on active
    // rep_route_assignments on any of the doctor routes)
    @Query(value = """
                select u.username
                from doctor_routes dr
                join rep_route_assignments a on a.route_id = dr.route_id
                join users u on u.id = a.rep_user_id
                where dr.doctor_id = :doctorId
                  and a.enabled = true
                  and a.start_date <= current_date
                  and (a.end_date is null or a.end_date >= current_date)
                  and u.enabled = true
                  and u.role = 'MR'
                order by a.start_date desc, u.username asc
                limit 1
            """, nativeQuery = true)
    String findPrimaryRepUsernameForDoctor(@Param("doctorId") long doctorId);

    @Query(value = """
                select u.username
                from doctor_routes dr
                join rep_route_assignments a on a.route_id = dr.route_id
                join users u on u.id = a.rep_user_id
                where dr.doctor_id = :doctorId
                  and a.enabled = true
                  and a.start_date <= current_date
                  and (a.end_date is null or a.end_date >= current_date)
                  and u.enabled = true
                  and u.role = 'MR'
                order by a.start_date desc, u.username asc
                offset 1
                limit 1
            """, nativeQuery = true)
    String findSecondaryRepUsernameForDoctor(@Param("doctorId") long doctorId);

}