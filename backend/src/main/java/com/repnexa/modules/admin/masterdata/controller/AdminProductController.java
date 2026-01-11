package com.repnexa.modules.admin.masterdata.controller;

import com.repnexa.modules.admin.masterdata.dto.ProductDtos;
import com.repnexa.modules.admin.masterdata.service.AdminProductService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/products")
public class AdminProductController {

    private final AdminProductService svc;

    public AdminProductController(AdminProductService svc) {
        this.svc = svc;
    }

    @GetMapping
    public List<ProductDtos.ProductResponse> list(@RequestParam(name = "q", required = false) String q) {
        return svc.list(q);
    }

    @PostMapping
    public ProductDtos.ProductResponse create(@RequestBody ProductDtos.CreateProductRequest req) {
        return svc.create(req);
    }

    @PatchMapping("/{id}")
    public ProductDtos.ProductResponse patch(@PathVariable long id, @RequestBody ProductDtos.PatchProductRequest req) {
        return svc.patch(id, req);
    }
}
