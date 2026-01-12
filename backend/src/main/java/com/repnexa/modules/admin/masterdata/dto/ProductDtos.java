package com.repnexa.modules.admin.masterdata.dto;

public final class ProductDtos {
  private ProductDtos() {
  }

  public record ProductResponse(Long id, String code, String name, boolean deleted) {
  }

  public record CreateProductRequest(String code, String name) {
  }

  public record PatchProductRequest(String code, String name, Boolean deleted) {
  }
}
