package com.repnexa.modules.rep.todo;

import com.repnexa.modules.rep.todo.service.RepTodoService;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class RepTodoServiceTest {

    @Test
    void sprintWindow_isDeterministic_14DaysInclusive() {
        LocalDate today = LocalDate.of(2026, 1, 24);
        assertEquals(LocalDate.of(2026, 1, 11), RepTodoService.sprintWindowStart(today));
        assertEquals(LocalDate.of(2026, 1, 24), RepTodoService.sprintWindowEnd(today));
    }
}