package com.repnexa.modules.analytics.company;

import jakarta.servlet.http.Cookie;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.contains;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

@SpringBootTest
class CompanyOverviewScopeIT {

    @Autowired WebApplicationContext wac;
    @Autowired JdbcTemplate jdbc;

    MockMvc mvc;

    private static final Pattern TOKEN_JSON = Pattern.compile("\"token\"\\s*:\\s*\"([^\"]+)\"");

    long fmId;
    long ownedRouteId;
    long foreignRouteId;

    @BeforeEach
    void seed() {
        mvc = MockMvcBuilders.webAppContextSetup(wac)
                .apply(springSecurity())
                .build();

        // Create test principals so:
        // - CompanyOverviewService can resolve auth.getName() -> users.id
        // - MustChangePasswordFilter (if it hits DB) can find the principal row
        fmId = upsertUser("it6_fm@repnexa.local", "FM");
        upsertUser("it6_cm@repnexa.local", "CM");

        Long tOwned = jdbc.queryForObject("""
            INSERT INTO territories(code, name, owner_user_id)
            VALUES ('IT6_T_OWNED', 'IT6 Territory Owned', ?)
            ON CONFLICT (code) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id
            RETURNING id
        """, Long.class, fmId);

        Long tForeign = jdbc.queryForObject("""
            INSERT INTO territories(code, name, owner_user_id)
            VALUES ('IT6_T_FOREIGN', 'IT6 Territory Foreign', NULL)
            ON CONFLICT (code) DO UPDATE
                SET name = EXCLUDED.name,
                    owner_user_id = EXCLUDED.owner_user_id
            RETURNING id
        """, Long.class);

        ownedRouteId = jdbc.queryForObject("""
            INSERT INTO routes(territory_id, code, name)
            VALUES (?, 'IT6_R_OWNED', 'IT6 Route Owned')
            ON CONFLICT (code) DO UPDATE SET territory_id = EXCLUDED.territory_id
            RETURNING id
        """, Long.class, tOwned);

        foreignRouteId = jdbc.queryForObject("""
            INSERT INTO routes(territory_id, code, name)
            VALUES (?, 'IT6_R_FOREIGN', 'IT6 Route Foreign')
            ON CONFLICT (code) DO UPDATE SET territory_id = EXCLUDED.territory_id
            RETURNING id
        """, Long.class, tForeign);

        Long dOwned = jdbc.queryForObject("""
            INSERT INTO doctors(name) VALUES ('IT6 Doctor Owned') RETURNING id
        """, Long.class);
        Long dForeign = jdbc.queryForObject("""
            INSERT INTO doctors(name) VALUES ('IT6 Doctor Foreign') RETURNING id
        """, Long.class);

        jdbc.update("INSERT INTO doctor_routes(doctor_id, route_id) VALUES (?, ?) ON CONFLICT DO NOTHING", dOwned, ownedRouteId);
        jdbc.update("INSERT INTO doctor_routes(doctor_id, route_id) VALUES (?, ?) ON CONFLICT DO NOTHING", dForeign, foreignRouteId);
    }

    private long upsertUser(String username, String role) {
        return jdbc.queryForObject("""
            INSERT INTO users(username, password_hash, role)
            VALUES (?, 'x', ?)
            ON CONFLICT (username) DO UPDATE
                SET role = EXCLUDED.role,
                    password_hash = EXCLUDED.password_hash
            RETURNING id
        """, Long.class, username, role);
    }

    private record CsrfBundle(Cookie cookie, String token) {}

    private CsrfBundle fetchCsrf() throws Exception {
        MvcResult res = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();

        Cookie c = res.getResponse().getCookie("XSRF-TOKEN");
        String body = res.getResponse().getContentAsString();

        if (c == null || c.getValue() == null || c.getValue().isBlank()) {
            throw new IllegalStateException("XSRF-TOKEN cookie not set by /api/v1/auth/csrf");
        }
        Matcher m = TOKEN_JSON.matcher(body == null ? "" : body);
        if (!m.find() || m.group(1) == null || m.group(1).isBlank()) {
            throw new IllegalStateException("CSRF token not found in /api/v1/auth/csrf JSON body: " + body);
        }
        return new CsrfBundle(c, m.group(1));
    }

    @Test
    @WithMockUser(username = "it6_fm@repnexa.local", roles = "FM")
    void fm_routeIds_are_intersected_with_server_allowed() throws Exception {
        CsrfBundle csrf = fetchCsrf();
        String body = """
            {"period":"THIS_MONTH","routeIds":[%d,%d]}
        """.formatted(ownedRouteId, foreignRouteId);

        mvc.perform(post("/api/v1/analytics/company-overview")
                        .contentType(APPLICATION_JSON)
                        .content(body)
                        .cookie(csrf.cookie())
                        .header("X-CSRF-Token", csrf.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scope.effectiveRouteIds", hasSize(1)))
                .andExpect(jsonPath("$.scope.effectiveRouteIds[0]", is((int) ownedRouteId)))
                .andExpect(jsonPath("$.flags.noData", is(false)));
    }

    @Test
    @WithMockUser(username = "it6_cm@repnexa.local", roles = "CM")
    void cm_can_filter_by_fieldManagerId_and_intersection_applies() throws Exception {
        CsrfBundle csrf = fetchCsrf();
        String body = """
            {"period":"THIS_MONTH","fieldManagerId":%d,"routeIds":[%d,%d]}
        """.formatted(fmId, ownedRouteId, foreignRouteId);

        mvc.perform(post("/api/v1/analytics/company-overview")
                        .contentType(APPLICATION_JSON)
                        .content(body)
                        .cookie(csrf.cookie())
                        .header("X-CSRF-Token", csrf.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scope.effectiveRouteIds", hasSize(1)))
                .andExpect(jsonPath("$.scope.effectiveRouteIds", contains((int) ownedRouteId)));
    }
}