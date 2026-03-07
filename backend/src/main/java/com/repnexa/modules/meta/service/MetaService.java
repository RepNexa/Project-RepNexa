package com.repnexa.modules.meta.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class MetaService {

    private static final Map<String, Integer> GRADE_TARGETS = Map.of(
            "A", 6,
            "B", 4,
            "C", 2
    );

    private static final List<String> DOCTOR_GRADES = List.of("A", "B", "C");

    public Map<String, Integer> gradeTargets() {
        return GRADE_TARGETS;
    }

    public EnumsResponse enums() {
        return new EnumsResponse(DOCTOR_GRADES);
   }

    public record EnumsResponse(
           List<String> doctorGrades
    ) {}
}
