package com.repnexa.common.api;

import java.util.List;

public class ApiException extends RuntimeException {
    private final int status;
    private final String code;
    private final List<ApiFieldError> fieldErrors;

    public ApiException(int status, String code, String message, List<ApiFieldError> fieldErrors) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = fieldErrors;
    }

    public ApiException(int status, String code, String message) {
        this(status, code, message, null);
    }

    public int status() { return status; }
    public String code() { return code; }
    public List<ApiFieldError> fieldErrors() { return fieldErrors; }

    public static ApiException badRequest(String code, String message) {
        return new ApiException(400, code, message);
    }

    public static ApiException badRequest(String code, String message, List<ApiFieldError> fieldErrors) {
        return new ApiException(400, code, message, fieldErrors);
    }

    public static ApiException unauthorized(String code, String message) {
        return new ApiException(401, code, message);
    }

    public static ApiException forbidden(String code, String message) {
        return new ApiException(403, code, message);
    }

    public static ApiException notFound(String code, String message) {
        return new ApiException(404, code, message);
    }

    public static ApiException conflict(String code, String message) {
        return new ApiException(409, code, message);
    }

    public static ApiException conflict(String code, String message, List<ApiFieldError> fieldErrors) {
        return new ApiException(409, code, message, fieldErrors);
    }
}
