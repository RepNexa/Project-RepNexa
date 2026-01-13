package com.repnexa.modules.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.repnexa.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(SpringExtension.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class AuthSmokeTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;

    // debug helper (safe to keep; does nothing unless called)
    @Autowired(required = false) JdbcTemplate jdbc;

    @Test
    void me_requires_auth_401_with_api_error() throws Exception {
        mvc.perform(get("/api/v1/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
    }

    @Test
    void login_ok_then_me_ok() throws Exception {
        // DEBUG: verify seed user exists and migrations applied (won’t fail the test; just prints)
        if (jdbc != null) {
            try {
                Integer n = jdbc.queryForObject(
                        "select count(*) from users where username = ?",
                        Integer.class,
                        "cm@repnexa.local"
                );
                System.out.println("DEBUG users seed: cm@repnexa.local rows = " + n);
            } catch (Exception e) {
                System.out.println("DEBUG users seed check failed: " + e.getMessage());
            }

            try {
                Integer m = jdbc.queryForObject(
                        "select count(*) from flyway_schema_history where success = true",
                        Integer.class
                );
                System.out.println("DEBUG flyway applied migrations (success=true) = " + m);
            } catch (Exception e) {
                System.out.println("DEBUG flyway history check failed: " + e.getMessage());
            }
        }

        var csrfResult = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();

        var xsrfCookie = csrfResult.getResponse().getCookie("XSRF-TOKEN");
        JsonNode csrfJson = objectMapper.readTree(csrfResult.getResponse().getContentAsString());
        String token = csrfJson.get("token").asText();

        MockHttpSession session = new MockHttpSession();

        mvc.perform(post("/api/v1/auth/login")
                        .session(session)
                        .cookie(xsrfCookie)
                        .header("X-CSRF-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"cm@repnexa.local\",\"password\":\"CM@1234\"}"))
                .andDo(r -> {
                    System.out.println("DEBUG login status = " + r.getResponse().getStatus());
                    System.out.println("DEBUG login body = " + r.getResponse().getContentAsString());
                })
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("CM"));

        mvc.perform(get("/api/v1/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("cm@repnexa.local"))
                .andExpect(jsonPath("$.role").value("CM"));
    }

    @Test
    void invalid_login_401_with_api_error() throws Exception {
        var csrfResult = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();

        var xsrfCookie = csrfResult.getResponse().getCookie("XSRF-TOKEN");
        JsonNode csrfJson = objectMapper.readTree(csrfResult.getResponse().getContentAsString());
        String token = csrfJson.get("token").asText();

        mvc.perform(post("/api/v1/auth/login")
                        .cookie(xsrfCookie)
                        .header("X-CSRF-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"cm@repnexa.local\",\"password\":\"WRONG\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("AUTH_INVALID_CREDENTIALS"));
    }
}
