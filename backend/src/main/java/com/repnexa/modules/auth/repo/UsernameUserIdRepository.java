package com.repnexa.modules.auth.repo;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class UsernameUserIdRepository {

    private final JdbcTemplate jdbc;

    public UsernameUserIdRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long requireUserIdByUsername(String username) {
        try {
            Long id = jdbc.queryForObject(
                    "SELECT id FROM users WHERE username = ?",
                    Long.class,
                    username
            );
            if (id == null) throw new IllegalStateException("User not found for username=" + username);
            return id;
        } catch (EmptyResultDataAccessException e) {
            throw new IllegalStateException("User not found for username=" + username, e);
        }
    }
}