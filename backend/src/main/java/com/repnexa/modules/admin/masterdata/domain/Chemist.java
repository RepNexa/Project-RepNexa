package com.repnexa.modules.admin.masterdata.domain;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "chemists")
public class Chemist {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "route_id", nullable = false)
  private Long routeId;

  @Column(nullable = false, length = 160)
  private String name;

  @Column(name = "deleted_at")
  private OffsetDateTime deletedAt;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  @PrePersist
  void prePersist() {
    OffsetDateTime now = OffsetDateTime.now();
    if (createdAt == null)
      createdAt = now;
    updatedAt = now;
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = OffsetDateTime.now();
  }

  public Long getId() {
    return id;
  }

  public Long getRouteId() {
    return routeId;
  }

  public String getName() {
    return name;
  }

  public OffsetDateTime getDeletedAt() {
    return deletedAt;
  }

  public void setRouteId(Long routeId) {
    this.routeId = routeId;
  }

  public void setName(String name) {
    this.name = name;
  }

  public void softDeleteNow() {
    this.deletedAt = OffsetDateTime.now();
  }
}
