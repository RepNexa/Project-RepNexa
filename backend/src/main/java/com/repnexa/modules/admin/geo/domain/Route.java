package com.repnexa.modules.admin.geo.domain;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "routes")
public class Route {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "territory_id", nullable = false)
    private Long territoryId;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 120)
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
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public Long getTerritoryId() { return territoryId; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public OffsetDateTime getDeletedAt() { return deletedAt; }

    public void setTerritoryId(Long territoryId) { this.territoryId = territoryId; }
    public void setCode(String code) { this.code = code; }
    public void setName(String name) { this.name = name; }
    public void softDeleteNow() { this.deletedAt = OffsetDateTime.now(); }
}
