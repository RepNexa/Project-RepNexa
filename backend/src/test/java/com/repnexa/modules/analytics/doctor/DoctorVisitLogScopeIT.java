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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.hamcrest.Matchers.is;

@ExtendWith(SpringExtension.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class DoctorVisitLogScopeIT {

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper om;
  @Autowired JdbcTemplate jdbc;

  @Test
  void fm_cannot_access_out_of_scope_doctor() throws Exception {
    Long fmUserId = jdbc.query("select id from users where username = 'fm@repnexa.local' limit 1",
        rs -> rs.next() ? rs.getLong(1) : null);
    Assumptions.assumeTrue(fmUserId != null, "Need fm user seeded");

    Long inScopeRoute = jdbc.query(
        """
        select r.id
        from routes r join territories t on t.id = r.territory_id
        where r.deleted_at is null and t.deleted_at is null and t.owner_user_id = ?
        limit 1
        """,
        ps -> ps.setLong(1, fmUserId),
        rs -> rs.next() ? rs.getLong(1) : null
    );
    Assumptions.assumeTrue(inScopeRoute != null, "Need at least one FM-owned route");

    Long outOfScopeDoctor = jdbc.query(
        """
        select dr.doctor_id
        from doctor_routes dr
        join routes r on r.id = dr.route_id
        join territories t on t.id = r.territory_id
        where r.deleted_at is null and t.deleted_at is null and t.owner_user_id <> ?
        limit 1
        """,
        ps -> ps.setLong(1, fmUserId),
        rs -> rs.next() ? rs.getLong(1) : null
    );
    Assumptions.assumeTrue(outOfScopeDoctor != null, "Need a doctor assigned to a non-FM route to validate scope");

    AuthedSession fm = login("fm@repnexa.local", "FM@1234");

    mvc.perform(get("/api/v1/analytics/doctors/" + outOfScopeDoctor + "/visit-log")
            .session(fm.session)
            .param("page", "0")
            .param("size", "10"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code", is("SCOPE_FORBIDDEN")));
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