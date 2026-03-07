package com.repnexa.modules.analytics.doctor;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.repnexa.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import java.time.LocalDate;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.hamcrest.Matchers.*;

@ExtendWith(SpringExtension.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class DoctorVisitLogPagingIT {

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper om;
  @Autowired JdbcTemplate jdbc;

  @Test
  void paging_returns_expected_counts_and_order() throws Exception {
    Long routeId = jdbc.query("select id from routes where deleted_at is null limit 1", rs -> rs.next() ? rs.getLong(1) : null);
    Assumptions.assumeTrue(routeId != null, "Need at least one route");

    Long doctorId = jdbc.query("select doctor_id from doctor_routes where route_id = ? limit 1", ps -> ps.setLong(1, routeId), rs -> rs.next() ? rs.getLong(1) : null);
    Assumptions.assumeTrue(doctorId != null, "Need at least one doctor_routes mapping");

    Long repUserId = jdbc.query("select rep_user_id from rep_route_assignments where route_id = ? limit 1", ps -> ps.setLong(1, routeId), rs -> rs.next() ? rs.getLong(1) : null);
    Assumptions.assumeTrue(repUserId != null, "Need at least one rep_route_assignments mapping");

    // Insert 30 deterministic calls (best-effort: assumes doctor_calls has columns (doctor_id, route_id, rep_user_id, call_date)).
    // If your schema differs, adjust this insert once.
    jdbc.update("delete from doctor_calls where doctor_id = ? and route_id = ?", doctorId, routeId);
    for (int i = 0; i < 30; i++) {
      jdbc.update(
          "insert into doctor_calls(doctor_id, route_id, rep_user_id, call_date) values (?, ?, ?, ?)",
          doctorId, routeId, repUserId, LocalDate.now().minusDays(i)
      );
    }

    AuthedSession cm = login("cm@repnexa.local", "CM@1234");

    mvc.perform(get("/api/v1/analytics/doctors/" + doctorId + "/visit-log")
            .session(cm.session)
            .param("page", "0")
            .param("size", "10")
            .param("dateFrom", LocalDate.now().minusDays(60).toString())
            .param("dateTo", LocalDate.now().toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.page", is(0)))
        .andExpect(jsonPath("$.size", is(10)))
        .andExpect(jsonPath("$.totalElements", greaterThanOrEqualTo(30)))
        .andExpect(jsonPath("$.items", hasSize(10)))
        .andExpect(jsonPath("$.items[0].callDate", is(LocalDate.now().toString())));
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