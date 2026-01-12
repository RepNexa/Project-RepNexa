package com.repnexa.modules.admin.masterdata.service;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.admin.masterdata.domain.Product;
import com.repnexa.modules.admin.masterdata.dto.ProductDtos;
import com.repnexa.modules.admin.masterdata.repo.ProductRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AdminProductService {

  private final ProductRepository products;

  public AdminProductService(ProductRepository products) {
    this.products = products;
  }

  @Transactional(readOnly = true)
  public List<ProductDtos.ProductResponse> list(String q) {
    return products.searchActiveByPrefix(trimToNull(q)).stream()
        .map(p -> new ProductDtos.ProductResponse(p.getId(), p.getCode(), p.getName(), p.getDeletedAt() != null))
        .toList();
  }

  @Transactional
  public ProductDtos.ProductResponse create(ProductDtos.CreateProductRequest req) {
    if (req == null || isBlank(req.code()) || isBlank(req.name())) {
      throw ApiException.badRequest("VALIDATION_ERROR", "code and name are required");
    }
    Product p = new Product();
    p.setCode(req.code().trim().toUpperCase());
    p.setName(req.name().trim());

    try {
      Product saved = products.save(p);
      return new ProductDtos.ProductResponse(saved.getId(), saved.getCode(), saved.getName(), false);
    } catch (DataIntegrityViolationException ex) {
      throw ApiException.conflict("PRODUCT_CODE_EXISTS", "Product code already exists");
    }
  }

  @Transactional
  public ProductDtos.ProductResponse patch(long id, ProductDtos.PatchProductRequest req) {
    Product p = products.findById(id)
        .orElseThrow(() -> ApiException.notFound("PRODUCT_NOT_FOUND", "Product not found"));
    if (p.getDeletedAt() != null)
      throw ApiException.conflict("PRODUCT_DELETED", "Product is deleted");

    if (req != null) {
      if (!isBlank(req.code()))
        p.setCode(req.code().trim().toUpperCase());
      if (!isBlank(req.name()))
        p.setName(req.name().trim());
      if (Boolean.TRUE.equals(req.deleted()))
        p.softDeleteNow();
    }

    try {
      Product saved = products.save(p);
      return new ProductDtos.ProductResponse(saved.getId(), saved.getCode(), saved.getName(),
          saved.getDeletedAt() != null);
    } catch (DataIntegrityViolationException ex) {
      throw ApiException.conflict("PRODUCT_CODE_EXISTS", "Product code already exists");
    }
  }

  private static boolean isBlank(String s) {
    return s == null || s.trim().isEmpty();
  }

  private static String trimToNull(String s) {
    if (s == null)
      return null;
    String t = s.trim();
    return t.isEmpty() ? null : t;
  }
}
