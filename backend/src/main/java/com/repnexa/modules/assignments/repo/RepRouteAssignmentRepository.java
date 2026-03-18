package com.repnexa.modules.assignments.repo;

import com.repnexa.modules.assignments.domain.RepRouteAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface RepRouteAssignmentRepository extends JpaRepository<RepRouteAssignment, Long> {

  interface RepRouteAssignmentRow {
    Long getId();

    Long getRepUserId();

    String getRepUsername();

    Long getRouteId();

    LocalDate getStartDate();

    LocalDate getEndDate();

    Boolean getEnabled();
  }

  @Query(value = """
          select
              a.id as id,
              a.rep_user_id as repUserId,
              u.username as repUsername,
              a.route_id as routeId,
              a.start_date as startDate,
              a.end_date as endDate,
              a.enabled as enabled
          from rep_route_assignments a
          join users u on u.id = a.rep_user_id
          where a.route_id in (:routeIds)
          order by a.id desc
      """, nativeQuery = true)
  List<RepRouteAssignmentRow> listForRouteIds(@Param("routeIds") List<Long> routeIds);
}