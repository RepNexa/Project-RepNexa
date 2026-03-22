package com.repnexa.config.security;

import com.repnexa.TestcontainersConfiguration;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class AuthVsCsrfBehaviorTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    @Test
    void anonymousPost_toAnalytics_returns401AuthRequired_not403Csrf() throws Exception {
        mvc.perform(post("/api/v1/analytics/company-overview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"period\":\"THIS_MONTH\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
    }

    @Test
    void authenticatedPost_missingCsrf_returns403CsrfInvalid() throws Exception {
        LoggedIn cm = login("cm@repnexa.local", "CM@1234");

        mvc.perform(post("/api/v1/analytics/company-overview")
                        .session(cm.session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"period\":\"THIS_MONTH\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    private LoggedIn login(String username, String password) throws Exception {
        // 1) Get CSRF token + cookie
        MvcResult csrfRes = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode csrfJson = om.readTree(csrfRes.getResponse().getContentAsString());
        String token = csrfJson.get("token").asText();

        Cookie xsrf = csrfRes.getResponse().getCookie("XSRF-TOKEN");
        if (xsrf == null) xsrf = new Cookie("XSRF-TOKEN", token);

        MockHttpSession session = (MockHttpSession) csrfRes.getRequest().getSession();

        // 2) Login with CSRF header + cookie
        mvc.perform(post("/api/v1/auth/login")
                        .session(session)
                        .cookie(xsrf)
                        .header("X-CSRF-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk());

        return new LoggedIn(session, xsrf, token);
    }

    private record LoggedIn(MockHttpSession session, Cookie xsrfCookie, String csrfToken) {}
}
