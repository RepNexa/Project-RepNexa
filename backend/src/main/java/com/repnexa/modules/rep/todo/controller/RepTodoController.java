package com.repnexa.modules.rep.todo.controller;

import com.repnexa.common.api.ApiException;
import com.repnexa.modules.auth.security.RepnexaUserDetails;
import com.repnexa.modules.rep.todo.dto.RepTodoDtos;
import com.repnexa.modules.rep.todo.service.RepTodoService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

@RestController
@RequestMapping("/api/v1/rep")
public class RepTodoController {

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("uuuu-MM");

    private final RepTodoService service;

    public RepTodoController(RepTodoService service) {
        this.service = service;
    }

    @GetMapping("/todo")
    public RepTodoDtos.TodoResponse todo(@AuthenticationPrincipal RepnexaUserDetails actor,
                                         @RequestParam(value = "month", required = false) String month,
                                         @RequestParam(value = "routeId", required = false) Long routeId) {

        if (actor == null) {
            throw ApiException.unauthorized("AUTH_REQUIRED", "Authentication required");
        }
        if (routeId == null || routeId <= 0) {
            throw ApiException.badRequest("VALIDATION_ERROR", "routeId is required");
        }
        if (month == null || month.isBlank()) {
            throw ApiException.badRequest("VALIDATION_ERROR", "month is required (YYYY-MM)");
        }

        final YearMonth ym;
        try {
            ym = YearMonth.parse(month.trim(), MONTH_FMT);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Invalid month format; expected YYYY-MM");
        }

        return service.getTodo(actor, routeId, ym);
    }
}
