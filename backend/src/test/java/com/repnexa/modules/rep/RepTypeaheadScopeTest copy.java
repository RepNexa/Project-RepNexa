package com.repnexa.modules.rep;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;

import jakarta.servlet.http.Cookie;

import com.repnexa.TestcontainersConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(SpringExtension.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class RepTypeaheadScopeTest {

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
    void mr_doctors_scoped_by_assigned_route_and_doctor_routes_membership() throws Exception {
        SessionCtx cm = login("cm@repnexa.local", "CM@1234");

        
        // Create territory + routes (unique per run to avoid 23505 / 409 flakiness)
        String suffix = java.util.UUID.randomUUID().toString().substring(0, 8);
        String tCode = "T1-" + suffix;
        String r1Code = "R1-" + suffix;
        String r2Code = "R2-" + suffix;

        var tRes = mvc.perform(post("/api/v1/admin/territories")
                        .session(cm.session())
                        .cookie(cm.csrf().cookie())
                        .header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + tCode + "\",\"name\":\"Territory 1\",\"ownerUsername\":\"fm@repnexa.local\"}"))
                .andExpect(status().isOk())
                .andReturn();
        long territoryId = om.readTree(tRes.getResponse().getContentAsString()).get("id").asLong();

        var r1Res = mvc.perform(post("/api/v1/admin/routes")
                        .session(cm.session())
                        .cookie(cm.csrf().cookie())
                        .header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"territoryId\":" + territoryId + ",\"code\":\"" + r1Code + "\",\"name\":\"Route 1\"}"))
                .andExpect(status().isOk()).andReturn();
        long route1Id = om.readTree(r1Res.getResponse().getContentAsString()).get("id").asLong();

        var r2Res = mvc.perform(post("/api/v1/admin/routes")
                        .session(cm.session())
                        .cookie(cm.csrf().cookie())
                        .header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"territoryId\":" + territoryId + ",\"code\":\"" + r2Code + "\",\"name\":\"Route 2\"}"))
                .andExpect(status().isOk()).andReturn();
        long route2Id = om.readTree(r2Res.getResponse().getContentAsString()).get("id").asLong();


        // Assign MR to route1 only
        mvc.perform(post("/api/v1/assignments/rep-routes")
                        .session(cm.session())
                        .cookie(cm.csrf().cookie())
                        .header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"repUsername\":\"mr@repnexa.local\",\"routeId\":" + route1Id + ",\"startDate\":\"2026-01-09\"}"))
                .andExpect(status().isOk());

        // Create two doctors
        var d1Res = mvc.perform(post("/api/v1/admin/doctors")
                        .session(cm.session())
                        .cookie(cm.csrf().cookie())
                        .header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Alice-" + suffix + "\",\"specialty\":\"Cardiology\"}"))
                .andExpect(status().isOk()).andReturn();
        long doctorAliceId = om.readTree(d1Res.getResponse().getContentAsString()).get("id").asLong();

        var d2Res = mvc.perform(post("/api/v1/admin/doctors")
                        .session(cm.session())
                        .cookie(cm.csrf().cookie())
                        .header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Bob-" + suffix + "\",\"specialty\":\"ENT\"}"))
                .andExpect(status().isOk()).andReturn();
        long doctorBobId = om.readTree(d2Res.getResponse().getContentAsString()).get("id").asLong();

        // Map Alice->route1 and Bob->route2
        mvc.perform(post("/api/v1/assignments/doctor-routes")
                        .session(cm.session())
                        .cookie(cm.csrf().cookie())
                        .header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"doctorId\":" + doctorAliceId + ",\"routeId\":" + route1Id + "}"))
                .andExpect(status().isOk());

        mvc.perform(post("/api/v1/assignments/doctor-routes")
                        .session(cm.session())
                        .cookie(cm.csrf().cookie())
                        .header("X-CSRF-Token", cm.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"doctorId\":" + doctorBobId + ",\"routeId\":" + route2Id + "}"))
                .andExpect(status().isOk());

        // MR can query route1 doctors and sees Alice only
        SessionCtx mr = login("mr@repnexa.local", "MR@1234");
        mvc.perform(get("/api/v1/rep/doctors")
                        .session(mr.session())
                        .param("routeId", String.valueOf(route1Id))
                        .param("q", "A"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("Alice-" + suffix));

        // MR cannot query route2 (not assigned)
        mvc.perform(get("/api/v1/rep/doctors")
                        .session(mr.session())
                        .param("routeId", String.valueOf(route2Id))
                        .param("q", "B"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("SCOPE_FORBIDDEN"));
    }
}
