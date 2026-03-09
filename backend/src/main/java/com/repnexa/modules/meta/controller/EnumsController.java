package com.repnexa.modules.meta.controller;

import com.repnexa.modules.meta.service.MetaService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/meta")
public class EnumsController {

    private final MetaService meta;

    public EnumsController(MetaService meta) {
        this.meta = meta;
    }

    @GetMapping("/enums")
    public MetaService.EnumsResponse enums() {
        return meta.enums();
    }
}