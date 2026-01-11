package com.repnexa.modules.admin.masterdata.controller;

import com.repnexa.modules.admin.masterdata.dto.DoctorDtos;
import com.repnexa.modules.admin.masterdata.service.AdminDoctorService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/doctors")
public class AdminDoctorController {

  private final AdminDoctorService svc;

  public AdminDoctorController(AdminDoctorService svc) {
    this.svc = svc;
  }

  @GetMapping
  public List<DoctorDtos.DoctorResponse> list(@RequestParam(name = "q", required = false) String q) {
    return svc.list(q);
  }

  @PostMapping
  public DoctorDtos.DoctorResponse create(@RequestBody DoctorDtos.CreateDoctorRequest req) {
    return svc.create(req);
  }

  @PatchMapping("/{id}")
  public DoctorDtos.DoctorResponse patch(@PathVariable long id, @RequestBody DoctorDtos.PatchDoctorRequest req) {
    return svc.patch(id, req);
  }
}
