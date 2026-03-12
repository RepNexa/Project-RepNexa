package com.repnexa.modules.lookup.repo;

import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ProductLookupJdbcRepository {

    private final JdbcTemplate jdbc;

    public ProductLookupJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Item> search(String q, int limit) {
        String qq = q == null ? "" : q.trim().toLowerCase();
        return jdbc.query("""
            SELECT id, code, name
            FROM products
            WHERE deleted_at IS NULL
              AND (? = '' OR LOWER(name) LIKE (? || '%') OR LOWER(code) LIKE (? || '%'))
            ORDER BY name
            LIMIT ?
        """, (rs, i) -> new Item(
                rs.getLong("id"),
                rs.getString("code"),
                rs.getString("name")
        ), qq, qq, qq, limit);
    }

    public record Item(long id, String code, String name) {}
}
