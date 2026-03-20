package com.repnexa.modules.meta;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.repnexa.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(SpringExtension.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class MetaEndpointsSmokeTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    record Csrf(Cookie cookie, String token) {}
    record SessionCtx(MockHttpSession session, Csrf csrf) {}

    private Csrf csrf() throws Exception {
        var res = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();
        Cookie xsrfCookie = res.getResponse().getCookie("XSRF-TOKEN");
        JsonNode json = om.readTree(res.getResponse().getContentAsString());
        return new Csrf(xsrfCookie, json.get("token").asText());
    }

    private SessionCtx login(String username, String password) throws Exception {
        Csrf c = csrf();
        MockHttpSession session = new MockHttpSession();
        mvc.perform(post("/api/v1/auth/login")
                        .session(session)
                        .cookie(c.cookie())
                        .header("X-CSRF-Token", c.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk());
        return new SessionCtx(session, c);
    }

    @Test
    void meta_endpoints_return_expected_enums_and_targets_for_authenticated_user() throws Exception {
        SessionCtx mr = login("mr@repnexa.local", "MR@1234");

        JsonNode enums = om.readTree(mvc.perform(get("/api/v1/meta/enums")
                        .session(mr.session())
                        .cookie(mr.csrf().cookie()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());

        assertTrue(enums.get("doctorGrades").isArray());
        assertEquals(3, enums.get("doctorGrades").size());
        assertEquals("A", enums.get("doctorGrades").get(0).asText());
        assertEquals("B", enums.get("doctorGrades").get(1).asText());
        assertEquals("C", enums.get("doctorGrades").get(2).asText());

        JsonNode targets = om.readTree(mvc.perform(get("/api/v1/meta/targets")
                        .session(mr.session())
                        .cookie(mr.csrf().cookie()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());

        assertEquals(6, targets.get("A").asInt());
        assertEquals(4, targets.get("B").asInt());
        assertEquals(2, targets.get("C").asInt());
    }
}
