package com.repnexa.modules.admin.masterdata;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.admin.masterdata.domain.Product;
import com.repnexa.modules.admin.masterdata.dto.ProductDtos;
import com.repnexa.modules.admin.masterdata.repo.ProductRepository;
import com.repnexa.modules.admin.masterdata.service.AdminProductService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminProductServiceTest {

    @Mock ProductRepository products;
    @InjectMocks AdminProductService service;

    @Test
    void create_normalizes_uppercase_code_and_trimmed_name() {
        when(products.save(any(Product.class))).thenAnswer(invocation -> {
            Product p = invocation.getArgument(0, Product.class);
            ReflectionTestUtils.setField(p, "id", 55L);
            return p;
        });

        ProductDtos.ProductResponse res = service.create(new ProductDtos.CreateProductRequest(" ab-12 ", "  Sample Product  "));

        ArgumentCaptor<Product> captor = ArgumentCaptor.forClass(Product.class);
        verify(products).save(captor.capture());
        Product saved = captor.getValue();

        assertEquals("AB-12", saved.getCode());
        assertEquals("Sample Product", saved.getName());
        assertEquals(55L, res.id());
        assertEquals("AB-12", res.code());
        assertEquals("Sample Product", res.name());
        assertFalse(res.deleted());
    }

    @Test
    void create_duplicate_code_maps_to_product_code_exists() {
        when(products.save(any(Product.class))).thenThrow(new DataIntegrityViolationException("duplicate"));

        ApiException ex = assertThrows(ApiException.class, () ->
                service.create(new ProductDtos.CreateProductRequest("P1", "Product 1"))
        );

        assertEquals(409, ex.status());
        assertEquals("PRODUCT_CODE_EXISTS", ex.code());
    }
    @Test
    void create_missing_code_or_name_throws_validation_error() {
        ApiException ex1 = assertThrows(ApiException.class, () ->
                service.create(new ProductDtos.CreateProductRequest(null, "Product 1"))
        );
        assertEquals(400, ex1.status());
        assertEquals("VALIDATION_ERROR", ex1.code());

        ApiException ex2 = assertThrows(ApiException.class, () ->
                service.create(new ProductDtos.CreateProductRequest("P1", "   "))
        );
        assertEquals(400, ex2.status());
        assertEquals("VALIDATION_ERROR", ex2.code());

        verify(products, never()).save(any(Product.class));
    }

    @Test
    void patch_missing_product_throws_product_not_found() {
        when(products.findById(999L)).thenReturn(java.util.Optional.empty());

        ApiException ex = assertThrows(ApiException.class, () ->
                service.patch(999L, new ProductDtos.PatchProductRequest("P2", null, null))
        );

        assertEquals(404, ex.status());
        assertEquals("PRODUCT_NOT_FOUND", ex.code());
        verify(products, never()).save(any(Product.class));
    }

    @Test
    void patch_rejects_deleted_product() {
        Product existing = new Product();
        ReflectionTestUtils.setField(existing, "id", 56L);
        ReflectionTestUtils.setField(existing, "deletedAt", java.time.OffsetDateTime.now());

        when(products.findById(56L)).thenReturn(java.util.Optional.of(existing));

        ApiException ex = assertThrows(ApiException.class, () ->
                service.patch(56L, new ProductDtos.PatchProductRequest("P2", "Updated", null))
        );

        assertEquals(409, ex.status());
        assertEquals("PRODUCT_DELETED", ex.code());
        verify(products, never()).save(any(Product.class));
    }

    @Test
    void patch_duplicate_code_maps_to_product_code_exists() {
        Product existing = new Product();
        ReflectionTestUtils.setField(existing, "id", 57L);
        existing.setCode("P1");
        existing.setName("Product 1");

        when(products.findById(57L)).thenReturn(java.util.Optional.of(existing));
        when(products.save(any(Product.class))).thenThrow(new DataIntegrityViolationException("duplicate"));

        ApiException ex = assertThrows(ApiException.class, () ->
                service.patch(57L, new ProductDtos.PatchProductRequest("P2", null, null))
        );

        assertEquals(409, ex.status());
        assertEquals("PRODUCT_CODE_EXISTS", ex.code());
    }
}
