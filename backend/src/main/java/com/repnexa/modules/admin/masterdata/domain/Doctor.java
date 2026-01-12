package com.repnexa.modules.admin.masterdata.domain;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "doctors")
public class Doctor {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 160)
  private String name;

  @Column(length = 120)
  private String specialty;

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

  public String getName() {
    return name;
  }

  public String getSpecialty() {
    return specialty;
  }

  public OffsetDateTime getDeletedAt() {
    return deletedAt;
  }

  public void setName(String name) {
    this.name = name;
  }

  public void setSpecialty(String specialty) {
    this.specialty = specialty;
  }

  public void softDeleteNow() {
    this.deletedAt = OffsetDateTime.now();
  }
}
