package com.repnexa.modules.rep.todo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.Filter;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Import(RepTodoEmptyStateIT.FixedClockConfig.class)
class RepTodoEmptyStateIT {

    @TestConfiguration
    static class FixedClockConfig {
        @Bean
        @Primary
        public Clock fixedClock() {
            return Clock.fixed(Instant.parse("2026-01-24T00:00:00Z"), ZoneOffset.UTC);
        }
    }

    @Autowired WebApplicationContext wac;
    @Autowired @Qualifier("springSecurityFilterChain") Filter springSecurityFilterChain;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;

    private MockMvc mockMvc;

    @BeforeEach
    void setupMockMvc() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(wac)
                .addFilters(springSecurityFilterChain)
                .build();
    }

    private long idOfUser(String username) {
        Long id = jdbc.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, username);
        if (id == null) throw new IllegalStateException("Expected user to exist: " + username);
        return id;
    }

    private record AuthCtx(String csrfToken, Cookie xsrfCookie, Cookie jsessionCookie) {}

    private AuthCtx loginMr() throws Exception {
        var csrfRes = mockMvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode csrfJson = mapper.readTree(csrfRes.getResponse().getContentAsString());
        String token = csrfJson.get("token").asText();
        Cookie xsrf = csrfRes.getResponse().getCookie("XSRF-TOKEN");

        var loginRes = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .cookie(xsrf)
                        .header("X-CSRF-Token", token)
                        .content("{\"username\":\"mr@repnexa.local\",\"password\":\"MR@1234\"}"))
                .andExpect(status().isOk())
                .andReturn();

        Cookie jsession = loginRes.getResponse().getCookie("JSESSIONID");
        return new AuthCtx(token, xsrf, jsession);
    }

    @Test
    void todo_with_no_doctors_configured_returns_empty_rows_not_error() throws Exception {
        long fmId = idOfUser("fm@repnexa.local");
        long cmId = idOfUser("cm@repnexa.local");
        long mrId = idOfUser("mr@repnexa.local");

        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();

        long territoryId = jdbc.queryForObject("""
                INSERT INTO territories (code, name, owner_user_id, deleted_at)
                VALUES (?, ?, ?, NULL)
                RETURNING id
                """, Long.class, "TE" + suffix, "Empty Todo Territory " + suffix, fmId);

        long routeId = jdbc.queryForObject("""
                INSERT INTO routes (territory_id, code, name, deleted_at)
                VALUES (?, ?, ?, NULL)
                RETURNING id
                """, Long.class, territoryId, "RE" + suffix, "Empty Todo Route " + suffix);

        jdbc.queryForObject("""
                INSERT INTO rep_route_assignments (rep_user_id, route_id, assigned_by_user_id, start_date, end_date, enabled)
                VALUES (?, ?, ?, DATE '2000-01-01', NULL, TRUE)
                RETURNING id
                """, Long.class, mrId, routeId, cmId);

        AuthCtx auth = loginMr();

        JsonNode todo = mapper.readTree(mockMvc.perform(get("/api/v1/rep/todo")
                        .param("month", "2026-01")
                        .param("routeId", String.valueOf(routeId))
                        .cookie(auth.xsrfCookie(), auth.jsessionCookie()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());

        assertEquals(routeId, todo.get("routeId").asLong());
        assertEquals("2026-01", todo.get("month").asText());
        assertTrue(todo.get("rows").isArray());
        assertEquals(0, todo.get("rows").size());
    }
}
