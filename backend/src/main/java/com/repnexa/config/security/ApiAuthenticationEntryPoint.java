package com.repnexa.config.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.repnexa.common.api.ApiErrorWriter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

import java.io.IOException;
import java.util.List;

public final class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper mapper;

    public ApiAuthenticationEntryPoint(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException ex) throws IOException {
        ApiErrorWriter.write(
                mapper,
                response,
                401,
                "Unauthorized",
                "AUTH_REQUIRED",
                "Authentication required",
                request.getRequestURI(),
                RequestIdSupport.requestId(request),
                List.of()
        );
    }
}
