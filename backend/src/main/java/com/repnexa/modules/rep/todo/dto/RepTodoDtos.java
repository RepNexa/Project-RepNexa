package com.repnexa.modules.rep.todo.dto;

import java.time.LocalDate;
import java.util.List;

public final class RepTodoDtos {

    private RepTodoDtos() {}

    public record TodoResponse(
            long routeId,
            String month,
            List<Row> rows
    ) {}

    public record Row(
            long doctorId,
            String doctorName,
            String grade,
            int plannedFrequency,
            int visitsThisMonth,
            int remaining,
            LocalDate lastVisitDate,
            boolean atRisk,
            LocalDate sprintWindowStart,
            LocalDate sprintWindowEnd
    ) {}
}