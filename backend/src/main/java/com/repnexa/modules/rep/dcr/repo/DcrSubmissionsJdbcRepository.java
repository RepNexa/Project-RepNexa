package com.repnexa.modules.rep.dcr.repo;

import com.repnexa.modules.rep.dcr.dto.DcrSubmissionDtos;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Repository
public class DcrSubmissionsJdbcRepository {

    private final JdbcTemplate jdbc;

    public DcrSubmissionsJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Long> findByIdempotencyKey(long repUserId, String key) {
        if (key == null || key.isBlank()) return Optional.empty();
        List<Long> ids = jdbc.query("""
            SELECT id FROM dcr_submissions
            WHERE rep_user_id = ? AND idempotency_key = ?
            LIMIT 1
        """, (rs, i) -> rs.getLong("id"), repUserId, key);
        return ids.isEmpty() ? Optional.empty() : Optional.of(ids.get(0));
    }

    public long insertSubmission(long repUserId, long repRouteAssignmentId, LocalDate callDate, String idempotencyKey) {
        return jdbc.queryForObject("""
            INSERT INTO dcr_submissions (rep_user_id, rep_route_assignment_id, call_date, idempotency_key)
            VALUES (?, ?, ?, ?)
            RETURNING id
        """, Long.class, repUserId, repRouteAssignmentId, callDate,
                (idempotencyKey == null || idempotencyKey.isBlank()) ? null : idempotencyKey);
    }

    public long insertDoctorCall(long submissionId, long repUserId, long routeId, LocalDate callDate,
                                 long doctorId, String callType) {
        return jdbc.queryForObject("""
            INSERT INTO doctor_calls (submission_id, rep_user_id, route_id, call_date, doctor_id, call_type)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id
        """, Long.class, submissionId, repUserId, routeId, callDate, doctorId, callType);
    }

    public void insertDoctorCallProducts(long doctorCallId, List<Long> productIds) {
        if (productIds == null || productIds.isEmpty()) return;
        jdbc.batchUpdate("""
            INSERT INTO doctor_call_products (doctor_call_id, product_id)
            VALUES (?, ?)
        """, productIds, 100, (ps, pid) -> {
            ps.setLong(1, doctorCallId);
            ps.setLong(2, pid);
        });
    }

    public long insertMissedDoctor(long submissionId, long repUserId, long routeId, LocalDate missedDate,
                                   long doctorId, String reason) {
        return jdbc.queryForObject("""
            INSERT INTO missed_doctors (submission_id, rep_user_id, route_id, missed_date, doctor_id, reason)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id
        """, Long.class, submissionId, repUserId, routeId, missedDate, doctorId, reason);
    }

    public Set<Long> findExistingDoctorCallDoctorIds(long repUserId, LocalDate callDate, Collection<Long> doctorIds) {
        if (doctorIds == null || doctorIds.isEmpty()) return Set.of();
        String in = doctorIds.stream().map(x -> "?").collect(Collectors.joining(","));
        List<Object> args = new ArrayList<>();
        args.add(repUserId);
        args.add(callDate);
        args.addAll(doctorIds);

        String sql = """
            SELECT doctor_id
            FROM doctor_calls
            WHERE rep_user_id = ? AND call_date = ?
              AND doctor_id IN (%s)
        """.formatted(in);

        List<Long> rows = jdbc.query(sql, (rs, i) -> rs.getLong("doctor_id"), args.toArray());
        return new HashSet<>(rows);
    }

    public Set<Long> findExistingMissedDoctorDoctorIds(long repUserId, LocalDate missedDate, Collection<Long> doctorIds) {
        if (doctorIds == null || doctorIds.isEmpty()) return Set.of();
        String in = doctorIds.stream().map(x -> "?").collect(Collectors.joining(","));
        List<Object> args = new ArrayList<>();
        args.add(repUserId);
        args.add(missedDate);
        args.addAll(doctorIds);

        String sql = """
            SELECT doctor_id
            FROM missed_doctors
            WHERE rep_user_id = ? AND missed_date = ?
              AND doctor_id IN (%s)
        """.formatted(in);

        List<Long> rows = jdbc.query(sql, (rs, i) -> rs.getLong("doctor_id"), args.toArray());
        return new HashSet<>(rows);
    }

    public List<DcrSubmissionDtos.SubmissionListItem> listSubmissions(long repUserId, int limit) {
        return jdbc.query("""
            SELECT
              s.id,
              s.call_date,
              s.rep_route_assignment_id,
              r.id AS route_id,
              r.name AS route_name,
              r.code AS route_code,
              t.name AS territory_name,
              s.submitted_at,
              (SELECT COUNT(*) FROM doctor_calls dc WHERE dc.submission_id = s.id) AS doctor_call_count,
              (SELECT COUNT(*) FROM missed_doctors md WHERE md.submission_id = s.id) AS missed_count
            FROM dcr_submissions s
            JOIN rep_route_assignments a ON a.id = s.rep_route_assignment_id
            JOIN routes r ON r.id = a.route_id
            JOIN territories t ON t.id = r.territory_id
            WHERE s.rep_user_id = ?
            ORDER BY s.call_date DESC, s.id DESC
            LIMIT ?
        """, (rs, i) -> new DcrSubmissionDtos.SubmissionListItem(
                rs.getLong("id"),
                rs.getObject("call_date", LocalDate.class),
                rs.getLong("rep_route_assignment_id"),
                rs.getLong("route_id"),
                rs.getString("route_name"),
                rs.getString("route_code"),
                rs.getString("territory_name"),
                rs.getObject("submitted_at", OffsetDateTime.class),
                rs.getInt("doctor_call_count"),
                rs.getInt("missed_count")
        ), repUserId, limit);
    }

    public Optional<DcrSubmissionDtos.SubmissionDetails> getSubmissionDetails(long repUserId, long submissionId) {
        List<SubmissionRow> subRows = jdbc.query("""
            SELECT
              s.id,
              s.call_date,
              s.rep_route_assignment_id,
              r.id AS route_id,
              r.name AS route_name,
              r.code AS route_code,
              t.name AS territory_name,
              s.submitted_at
            FROM dcr_submissions s
            JOIN rep_route_assignments a ON a.id = s.rep_route_assignment_id
            JOIN routes r ON r.id = a.route_id
            JOIN territories t ON t.id = r.territory_id
            WHERE s.rep_user_id = ? AND s.id = ?
            LIMIT 1
        """, (rs, i) -> new SubmissionRow(
                rs.getLong("id"),
                rs.getObject("call_date", LocalDate.class),
                rs.getLong("rep_route_assignment_id"),
                rs.getLong("route_id"),
                rs.getString("route_name"),
                rs.getString("route_code"),
                rs.getString("territory_name"),
                rs.getObject("submitted_at", OffsetDateTime.class)
        ), repUserId, submissionId);

        if (subRows.isEmpty()) return Optional.empty();
        SubmissionRow sub = subRows.get(0);

        List<DcrSubmissionDtos.DoctorCallDetails> calls = loadDoctorCalls(submissionId);
        List<DcrSubmissionDtos.MissedDoctorDetails> missed = loadMissedDoctors(submissionId);

        return Optional.of(new DcrSubmissionDtos.SubmissionDetails(
                sub.id, sub.callDate, sub.repRouteAssignmentId, sub.routeId,
                sub.routeName, sub.routeCode, sub.territoryName, sub.submittedAt,
                calls, missed
        ));
    }

    private List<DcrSubmissionDtos.DoctorCallDetails> loadDoctorCalls(long submissionId) {
        record CallRow(long id, long doctorId, String doctorName, String specialty, String callType) {}
        List<CallRow> rows = jdbc.query("""
            SELECT
              dc.id,
              d.id AS doctor_id,
              d.name AS doctor_name,
              d.specialty,
              dc.call_type
            FROM doctor_calls dc
            JOIN doctors d ON d.id = dc.doctor_id
            WHERE dc.submission_id = ?
            ORDER BY dc.id
        """, (rs, i) -> new CallRow(
                rs.getLong("id"),
                rs.getLong("doctor_id"),
                rs.getString("doctor_name"),
                rs.getString("specialty"),
                rs.getString("call_type")
        ), submissionId);

        Map<Long, List<DcrSubmissionDtos.ProductItem>> productsByCall = jdbc.query("""
            SELECT
              dcp.doctor_call_id,
              p.id AS product_id,
              p.code,
              p.name
            FROM doctor_call_products dcp
            JOIN products p ON p.id = dcp.product_id
            WHERE dcp.doctor_call_id IN (
              SELECT id FROM doctor_calls WHERE submission_id = ?
            )
            ORDER BY dcp.doctor_call_id, p.name
        """, rs -> {
            Map<Long, List<DcrSubmissionDtos.ProductItem>> m = new HashMap<>();
            while (rs.next()) {
                long callId = rs.getLong("doctor_call_id");
                m.computeIfAbsent(callId, k -> new ArrayList<>())
                        .add(new DcrSubmissionDtos.ProductItem(
                                rs.getLong("product_id"),
                                rs.getString("code"),
                                rs.getString("name")
                        ));
            }
            return m;
        }, submissionId);

        return rows.stream()
                .map(r -> new DcrSubmissionDtos.DoctorCallDetails(
                        r.id, r.doctorId, r.doctorName, r.specialty, r.callType,
                        productsByCall.getOrDefault(r.id, List.of())
                ))
                .toList();
    }

    private List<DcrSubmissionDtos.MissedDoctorDetails> loadMissedDoctors(long submissionId) {
        return jdbc.query("""
            SELECT
              md.id,
              d.id AS doctor_id,
              d.name AS doctor_name,
              d.specialty,
              md.reason
            FROM missed_doctors md
            JOIN doctors d ON d.id = md.doctor_id
            WHERE md.submission_id = ?
            ORDER BY md.id
        """, (rs, i) -> new DcrSubmissionDtos.MissedDoctorDetails(
                rs.getLong("id"),
                rs.getLong("doctor_id"),
                rs.getString("doctor_name"),
                rs.getString("specialty"),
                rs.getString("reason")
        ), submissionId);
    }

    private record SubmissionRow(
            long id,
            LocalDate callDate,
            long repRouteAssignmentId,
            long routeId,
            String routeName,
            String routeCode,
            String territoryName,
            OffsetDateTime submittedAt
    ) {}
}
