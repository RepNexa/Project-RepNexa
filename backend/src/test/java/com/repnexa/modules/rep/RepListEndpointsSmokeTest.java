package com.repnexa.modules.rep;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class RepListEndpointsSmokeTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    @Test
    void mr_canGetMileageEntries_list_is200_not405() throws Exception {
        LoggedIn mr = login("mr@repnexa.local", "MR@1234");

        mvc.perform(get("/api/v1/rep/mileage-entries")
                        .session(mr.session))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
    }

    @Test
    void mr_canGetChemistSubmissions_list_is200_not405() throws Exception {
        LoggedIn mr = login("mr@repnexa.local", "MR@1234");

        mvc.perform(get("/api/v1/rep/chemist-submissions")
                        .session(mr.session))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
    }

    private LoggedIn login(String username, String password) throws Exception {
        MvcResult csrfRes = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode csrfJson = om.readTree(csrfRes.getResponse().getContentAsString());
        String token = csrfJson.get("token").asText();

        Cookie xsrf = csrfRes.getResponse().getCookie("XSRF-TOKEN");
        if (xsrf == null) xsrf = new Cookie("XSRF-TOKEN", token);

        MockHttpSession session = (MockHttpSession) csrfRes.getRequest().getSession();

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
