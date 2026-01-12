package com.repnexa.modules.lookup.controller;

import com.repnexa.modules.lookup.repo.ProductLookupJdbcRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/lookup")
public class ProductLookupController {

    private final ProductLookupJdbcRepository repo;

    public ProductLookupController(ProductLookupJdbcRepository repo) {
        this.repo = repo;
    }

    @GetMapping("/products")
    public List<ProductLookupJdbcRepository.Item> products(@RequestParam(name = "q", required = false) String q) {
        return repo.search(q, 20);
    }
}
