package com.repnexa.config.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.repnexa.common.api.ApiErrorWriter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;


@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper om = new ObjectMapper();
        om.registerModule(new JavaTimeModule());
        om.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return om;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper mapper) throws Exception {
        CookieCsrfTokenRepository csrfRepo = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfRepo.setCookieName("XSRF-TOKEN");
        csrfRepo.setHeaderName("X-CSRF-Token");
        csrfRepo.setCookiePath("/");

        http
            .csrf(csrf -> csrf.csrfTokenRepository(csrfRepo))
            .securityContext(sc -> sc.requireExplicitSave(false))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .exceptionHandling(eh -> eh
                    .authenticationEntryPoint(restAuthEntryPoint(mapper))
                    .accessDeniedHandler(restAccessDeniedHandler(mapper))
            )
            .authorizeHttpRequests(auth -> auth
                    .requestMatchers("/api/v1/auth/csrf").permitAll()
                    .requestMatchers("/api/v1/auth/login").permitAll()
                    .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()

                    .requestMatchers("/api/v1/me").authenticated()
                    .requestMatchers("/api/v1/auth/logout").authenticated()
                    .requestMatchers("/api/v1/auth/change-password").authenticated()

                    // CM-only admin geo
                    .requestMatchers("/api/v1/admin/**").hasRole("CM")

                    // Lookups: authenticated (CM/FM/MR)
                    .requestMatchers("/api/v1/lookup/**").authenticated()

                    // Doctor-route assignments are CM-only (override broader assignments rule)
                    .requestMatchers("/api/v1/assignments/doctor-routes").hasRole("CM")

                    // Assignments: CM or FM
                    .requestMatchers("/api/v1/assignments/**").hasAnyRole("CM", "FM")

                    // MR context
                    .requestMatchers("/api/v1/rep/**").hasRole("MR")

                    .anyRequest().denyAll()
            );

        // Must-change-password gate
        http.addFilterAfter(new MustChangePasswordFilter(mapper), org.springframework.security.web.csrf.CsrfFilter.class);

        return http.build();
    }

    private AuthenticationEntryPoint restAuthEntryPoint(ObjectMapper mapper) {
        return (request, response, authException) -> ApiErrorWriter.write(
                mapper,
                response,
                401,
                "Unauthorized",
                "AUTH_REQUIRED",
                "Authentication required",
                request.getRequestURI(),
                response.getHeader("X-Request-Id"),
                java.util.List.of()
        );
    }

    private AccessDeniedHandler restAccessDeniedHandler(ObjectMapper mapper) {
        return (request, response, accessDeniedException) -> {
            String code = "FORBIDDEN";
            String msg = "Access denied";
            if (accessDeniedException instanceof CsrfException) {
                code = "CSRF_INVALID";
                msg = "CSRF token missing or invalid";
            }
            ApiErrorWriter.write(
                    mapper,
                    response,
                    403,
                    "Forbidden",
                    code,
                    msg,
                    request.getRequestURI(),
                    response.getHeader("X-Request-Id"),
                    java.util.List.of()
            );
        };
    }
}
