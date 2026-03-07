package com.repnexa.modules.analytics.doctor;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.repnexa.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(SpringExtension.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class DoctorDetailsScopeIT {

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper om;
  @Autowired JdbcTemplate jdbc;

  @Test
  void cm_can_call_doctor_details_with_scope_resolved() throws Exception {
    AuthedSession cm = login("cm@repnexa.local", "CM@1234");
    Long routeId = jdbc.query("select id from routes where deleted_at is null limit 1",
        rs -> rs.next() ? rs.getLong(1) : null);
    Assumptions.assumeTrue(routeId != null, "Need at least one route seeded");

    String body = om.writeValueAsString(Map.of("period", "THIS_MONTH", "routeIds", java.util.List.of(routeId)));

    mvc.perform(post("/api/v1/analytics/doctor-details")
            .session(cm.session)
            .cookie(cm.xsrfCookie)
            .header("X-CSRF-Token", cm.csrfToken)
            .contentType("application/json")
            .content(body))
        .andExpect(status().is2xxSuccessful());
  }

  private AuthedSession login(String username, String password) throws Exception {
    MockHttpSession session = new MockHttpSession();
    MvcResult csrf1 = mvc.perform(get("/api/v1/auth/csrf").session(session))
        .andExpect(status().isOk()).andReturn();
    JsonNode n1 = om.readTree(csrf1.getResponse().getContentAsString());
    String t1 = n1.get("token").asText();
    var xsrf1 = csrf1.getResponse().getCookie("XSRF-TOKEN");

    mvc.perform(post("/api/v1/auth/login").session(session)
            .cookie(xsrf1)
            .header("X-CSRF-Token", t1)
            .contentType("application/json")
            .content(om.writeValueAsString(Map.of("username", username, "password", password))))
        .andExpect(status().is2xxSuccessful());

    MvcResult csrf2 = mvc.perform(get("/api/v1/auth/csrf").session(session))
        .andExpect(status().isOk()).andReturn();
    JsonNode n2 = om.readTree(csrf2.getResponse().getContentAsString());
    return new AuthedSession(session, csrf2.getResponse().getCookie("XSRF-TOKEN"), n2.get("token").asText());
  }

  record AuthedSession(MockHttpSession session, Cookie xsrfCookie, String csrfToken) {}
}