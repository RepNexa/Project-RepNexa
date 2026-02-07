package com.repnexa.common.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;

import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestControllerAdvice
public class GlobalExceptionHandler {

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


    // --- Fallback ---
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnhandled(Exception ex, HttpServletRequest req) {
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
