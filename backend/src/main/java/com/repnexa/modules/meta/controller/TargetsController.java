package com.repnexa.modules.meta.controller;

import com.repnexa.modules.meta.service.MetaService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/meta")
public class TargetsController {

    private final MetaService meta;

    public TargetsController(MetaService meta) {
        this.meta = meta;
    }

    @GetMapping("/targets")
    public Map<String, Integer> targets() {
        return meta.gradeTargets();
   }
}