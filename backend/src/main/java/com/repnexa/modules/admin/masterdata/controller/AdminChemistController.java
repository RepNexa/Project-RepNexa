package com.repnexa.modules.admin.masterdata.controller;

import com.repnexa.modules.admin.masterdata.dto.ChemistDtos;
import com.repnexa.modules.admin.masterdata.service.AdminChemistService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/chemists")
public class AdminChemistController {

  private final AdminChemistService svc;

  public AdminChemistController(AdminChemistService svc) {
    this.svc = svc;
  }

  @GetMapping
  public List<ChemistDtos.ChemistResponse> list(@RequestParam(name = "q", required = false) String q) {
    return svc.list(q);
  }

  @PostMapping
  public ChemistDtos.ChemistResponse create(@RequestBody ChemistDtos.CreateChemistRequest req) {
    return svc.create(req);
  }

  @PatchMapping("/{id}")
  public ChemistDtos.ChemistResponse patch(@PathVariable long id, @RequestBody ChemistDtos.PatchChemistRequest req) {
    return svc.patch(id, req);
  }
}
