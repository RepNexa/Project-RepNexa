package com.repnexa.common.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;

public final class ApiErrorWriter {
    private ApiErrorWriter() {}

    public static void write(
            ObjectMapper mapper,
            HttpServletResponse response,
            int status,
            String error,
            String code,
            String message,
            String path,
            String requestId,
            List<ApiFieldError> fieldErrors
    ) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        ApiError body = new ApiError(
                OffsetDateTime.now(),
                status,
                error,
                code,
                message,
                path,
                requestId,
                fieldErrors == null ? List.of() : fieldErrors
        );
        mapper.writeValue(response.getOutputStream(), body);
    }
}
