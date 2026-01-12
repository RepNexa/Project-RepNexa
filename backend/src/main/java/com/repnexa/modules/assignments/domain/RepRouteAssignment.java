package com.repnexa.modules.assignments.domain;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "rep_route_assignments")
public class RepRouteAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rep_user_id", nullable = false)
    private Long repUserId;

    @Column(name = "route_id", nullable = false)
    private Long routeId;

    @Column(name = "assigned_by_user_id", nullable = false)
    private Long assignedByUserId;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public Long getRepUserId() { return repUserId; }
    public Long getRouteId() { return routeId; }
    public Long getAssignedByUserId() { return assignedByUserId; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public boolean isEnabled() { return enabled; }

    public void setRepUserId(Long repUserId) { this.repUserId = repUserId; }
    public void setRouteId(Long routeId) { this.routeId = routeId; }
    public void setAssignedByUserId(Long assignedByUserId) { this.assignedByUserId = assignedByUserId; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
}
