package com.repnexa.common.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequestWrapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.core.NestedExceptionUtils;

import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;

// Spring MVC can throw this for "no resource" paths (e.g., trailing slash variants).
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private final Environment env;

    public GlobalExceptionHandler(Environment env) {
        this.env = env;
    }

    // --- API exceptions (your domain errors) ---
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApiException(ApiException ex, HttpServletRequest req) {
        HttpStatus hs = HttpStatus.resolve(ex.status());
        HttpStatus status = (hs != null ? hs : HttpStatus.INTERNAL_SERVER_ERROR);

        List<ApiFieldError> fields = normalizeFieldErrors(ex.fieldErrors());

        ApiError body = new ApiError(
                OffsetDateTime.now(),
                ex.status(),
                status.getReasonPhrase(),
                ex.code(),
                ex.getMessage(),
                req.getRequestURI(),
                requestId(req),
                fields
        );

        return ResponseEntity.status(ex.status()).body(body);
    }

    // --- Bean validation failures (@Valid) ---
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        List<ApiFieldError> fields = ex.getBindingResult().getFieldErrors().stream()
                .map(this::toApiFieldError)
                .toList();

        ApiError body = new ApiError(
                OffsetDateTime.now(),
                400,
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "VALIDATION_ERROR",
                "Validation failed",
                req.getRequestURI(),
                requestId(req),
                fields
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    // --- Authn failures (login) ---
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCreds(BadCredentialsException ex, HttpServletRequest req) {
        ApiError body = new ApiError(
                OffsetDateTime.now(),
                401,
                HttpStatus.UNAUTHORIZED.getReasonPhrase(),
                "AUTH_INVALID_CREDENTIALS",
                "Invalid username or password",
                req.getRequestURI(),
                requestId(req),
                List.of()
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
    }

    // --- Authz failures (RBAC) ---
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex, HttpServletRequest req) {
        String code = "RBAC_FORBIDDEN";
        String msg = "Access denied";
        if (ex instanceof CsrfException) {
            code = "CSRF_INVALID";
            msg = "CSRF token missing or invalid";
        }
        ApiError body = new ApiError(
                OffsetDateTime.now(),
                403,
                HttpStatus.FORBIDDEN.getReasonPhrase(),
                code,
                msg,
                req.getRequestURI(),
                requestId(req),
                List.of()
        );
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    // --- Malformed JSON body ---
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleBadJson(HttpMessageNotReadableException ex, HttpServletRequest req) {
        ApiError body = new ApiError(
                OffsetDateTime.now(),
                400,
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "VALIDATION_ERROR",
                "Malformed JSON request",
                req.getRequestURI(),
                requestId(req),
                List.of()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    // --- Wrong HTTP method ---
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex, HttpServletRequest req) {
        ApiError body = new ApiError(
                OffsetDateTime.now(),
                405,
                HttpStatus.METHOD_NOT_ALLOWED.getReasonPhrase(),
                "METHOD_NOT_ALLOWED",
                "Method not allowed",
                req.getRequestURI(),
                requestId(req),
                List.of()
        );
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(body);
    }

    // --- DB constraint conflicts ---
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleConflict(DataIntegrityViolationException ex, HttpServletRequest req) {
        int status = 409;
        String code = "CONFLICT";
        String msg = "Conflict";

        Optional<SQLException> sql = findSqlException(ex);
        if (sql.isPresent()) {
            SQLException sqlEx = sql.get();
            String sqlState = sqlEx.getSQLState();

            // Unique violation (PostgreSQL SQLSTATE 23505)
            if ("23505".equals(sqlState)) {
                String constraint = extractConstraintName(sqlEx).orElse(null);

                if ("ux_doctor_calls_rep_doctor_date".equalsIgnoreCase(constraint)) {
                    code = "DOCTOR_CALL_DUPLICATE";
                    msg = "Duplicate doctor call for this doctor on this date";
                } else if ("ux_missed_doctors_rep_doctor_date".equalsIgnoreCase(constraint)) {
                    code = "MISSED_DOCTOR_DUPLICATE";
                    msg = "Duplicate missed doctor for this doctor on this date";
                } else if ("ux_chemist_stock_flags_visit_product".equalsIgnoreCase(constraint)) {
                    code = "STOCK_FLAG_DUPLICATE";
                    msg = "Duplicate stock flag for the same product in the same visit";
                } else if ("ux_mileage_entries_rep_route_date".equalsIgnoreCase(constraint)) {
                    code = "MILEAGE_DUPLICATE";
                    msg = "Mileage already submitted for this route and date";
                } else {
                    code = "CONFLICT_UNIQUE";
                    msg = "Unique constraint violated";
                }
            }
        }

        ApiError body = new ApiError(
                OffsetDateTime.now(),
                status,
                HttpStatus.CONFLICT.getReasonPhrase(),
                code,
                msg,
                req.getRequestURI(),
                requestId(req),
                List.of()
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler({ org.springframework.jdbc.BadSqlGrammarException.class,
            org.springframework.dao.InvalidDataAccessResourceUsageException.class })
    public ResponseEntity<ApiError> handleBadSql(Exception ex, HttpServletRequest req) {
        Throwable root = NestedExceptionUtils.getMostSpecificCause(ex);
        String details = (root != null ? root.getMessage() : ex.getMessage());

        ApiError body = new ApiError(
                OffsetDateTime.now(),
                500,
                HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                "DB_BAD_SQL",
                details == null ? "Bad SQL grammar" : details,
                req.getRequestURI(),
                requestId(req),
                List.of()
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    // --- Missing required query param (?routeId=...) ---
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiError> handleMissingParam(MissingServletRequestParameterException ex, HttpServletRequest req) {
        ApiError body = new ApiError(
                OffsetDateTime.now(),
                400,
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "VALIDATION_ERROR",
                "Missing required parameter: " + ex.getParameterName(),
                req.getRequestURI(),
                requestId(req),
                List.of()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    // --- Query param type mismatch (?routeId=abc) ---
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest req) {
        String name = ex.getName();
        String val = (ex.getValue() == null ? "null" : ex.getValue().toString());

        ApiError body = new ApiError(
                OffsetDateTime.now(),
                400,
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "VALIDATION_ERROR",
                "Invalid parameter: " + name + "=" + val,
                req.getRequestURI(),
                requestId(req),
                List.of()
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    // --- No handler mapped (unknown endpoint) ---
    // NOTE: Only triggers if Spring is configured to throw NoHandlerFoundException.
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ApiError> handleNoHandler(NoHandlerFoundException ex, HttpServletRequest req) {
        ApiError body = new ApiError(
                OffsetDateTime.now(),
                404,
                HttpStatus.NOT_FOUND.getReasonPhrase(),
                "NOT_FOUND",
                "No handler for " + ex.getHttpMethod() + " " + ex.getRequestURL(),
                req.getRequestURI(),
                requestId(req),
                List.of()
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    // --- No static resource / no endpoint matched (often seen as 404 instead of NoHandlerFoundException) ---
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNoResource(NoResourceFoundException ex, HttpServletRequest req) {
        ApiError body = new ApiError(
                OffsetDateTime.now(),
                404,
                HttpStatus.NOT_FOUND.getReasonPhrase(),
                "NOT_FOUND",
                "Not found",
                req.getRequestURI(),
                requestId(req),
                List.of()
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    // --- ResponseStatusException (sometimes used internally to represent 404/405/etc.) ---
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> handleResponseStatus(ResponseStatusException ex, HttpServletRequest req) {
        int status = ex.getStatusCode().value();
        HttpStatus hs = HttpStatus.resolve(status);
        String reason = (hs != null ? hs.getReasonPhrase() : "Error");

        String code =
                (status == 404) ? "NOT_FOUND" :
                (status == 405) ? "METHOD_NOT_ALLOWED" :
                "ERROR";

        String msg =
                (status == 404) ? "Not found" :
                (status == 405) ? "Method not allowed" :
                (ex.getReason() != null ? ex.getReason() : "Request failed");

        ApiError body = new ApiError(
                OffsetDateTime.now(),
                status,
                reason,
                code,
                msg,
                req.getRequestURI(),
                requestId(req),
                List.of()
        );
        return ResponseEntity.status(status).body(body);
    }


    // --- Fallback ---
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnhandled(Exception ex, HttpServletRequest req) {
        // Dev-only: log stack trace for auditing without changing API responses.
        if (env.acceptsProfiles(Profiles.of("dev"))) {
            log.error("Unhandled exception requestId={} method={} path={}",
                    requestId(req), req.getMethod(), req.getRequestURI(), ex);
        }

        ApiError body = new ApiError(
                OffsetDateTime.now(),
                500,
                HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                "INTERNAL_ERROR",
                "Unexpected error",
                req.getRequestURI(),
                requestId(req),
                List.of()
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    // ----------------- helpers -----------------

    private ApiFieldError toApiFieldError(FieldError fe) {
        return new ApiFieldError(
                fe.getField(),
                fe.getDefaultMessage() == null ? "Invalid" : fe.getDefaultMessage()
        );
    }

    private String requestId(HttpServletRequest req) {
        Object attr = req.getAttribute("requestId");
        if (attr instanceof String s && !s.isBlank()) {
            return s;
        }

        String header = req.getHeader("X-Request-Id");
        if (header != null && !header.isBlank()) {
            return header;
        }

        return null;
    }


    private List<ApiFieldError> normalizeFieldErrors(List<ApiFieldError> fieldErrors) {
        if (fieldErrors == null || fieldErrors.isEmpty()) return List.of();
        return fieldErrors;
    }

    /**
     * Vendor-neutral: peel the most specific cause and accept any JDBC SQLException.
     */
    private Optional<SQLException> findSqlException(Throwable ex) {
        Throwable root = NestedExceptionUtils.getMostSpecificCause(ex);
        if (root instanceof SQLException sqlEx) return Optional.of(sqlEx);

        // Fallback: walk the chain (some drivers/frameworks wrap differently)
        Throwable cur = ex;
        while (cur != null) {
            if (cur instanceof SQLException s) return Optional.of(s);
            cur = cur.getCause();
        }
        return Optional.empty();
    }

    /**
     * Vendor-neutral: best-effort extraction from the exception message.
     * (PostgreSQL commonly includes: 'violates unique constraint "constraint_name"')
     */
    private Optional<String> extractConstraintName(SQLException ex) {
        String m = ex.getMessage();
        if (m == null) return Optional.empty();

        Pattern p = Pattern.compile("constraint\\s+\"([^\"]+)\"", Pattern.CASE_INSENSITIVE);
        Matcher mm = p.matcher(m);
        if (mm.find()) return Optional.of(mm.group(1));

        return Optional.empty();
    }
}
