package com.repnexa.config.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.repnexa.common.api.ApiErrorWriter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
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
import org.springframework.http.HttpMethod;


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
    AuthenticationEntryPoint apiAuthenticationEntryPoint(ObjectMapper mapper) {
        return new ApiAuthenticationEntryPoint(mapper);
    }

    @Bean
    AccessDeniedHandler apiAccessDeniedHandler(ObjectMapper mapper) {
        return new ApiAccessDeniedHandler(mapper);
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
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            ObjectMapper mapper,
            Environment env,
            AuthenticationEntryPoint apiAuthenticationEntryPoint,
            AccessDeniedHandler apiAccessDeniedHandler
    ) throws Exception {
        CookieCsrfTokenRepository csrfRepo = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfRepo.setCookieName("XSRF-TOKEN");
        csrfRepo.setHeaderName("X-CSRF-Token");
        csrfRepo.setCookiePath("/");

        boolean dev = env.acceptsProfiles(Profiles.of("dev"));

        http
            .csrf(csrf -> csrf.csrfTokenRepository(csrfRepo))
            .securityContext(sc -> sc.requireExplicitSave(false))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .exceptionHandling(eh -> eh
                    .authenticationEntryPoint(apiAuthenticationEntryPoint)
                    .accessDeniedHandler(apiAccessDeniedHandler)
            )
            .authorizeHttpRequests(auth -> {
                    auth.requestMatchers("/api/v1/auth/csrf").permitAll();
                    auth.requestMatchers("/api/v1/auth/login").permitAll();
                    auth.requestMatchers(HttpMethod.GET, "/actuator/health").permitAll();

                    if (dev) {
                        auth.requestMatchers("/actuator", "/actuator/**").hasRole("CM");
                    }

                    auth.requestMatchers("/api/v1/me").authenticated();
                    auth.requestMatchers("/api/v1/auth/logout").authenticated();
                    auth.requestMatchers("/api/v1/auth/change-password").authenticated();

                    // CM-only admin
                    auth.requestMatchers("/api/v1/admin/**").hasRole("CM");

                    // Lookups: authenticated (CM/FM/MR)
                    auth.requestMatchers("/api/v1/lookup/**").authenticated();

                    // Meta endpoints: authenticated (CM/FM/MR)
                    auth.requestMatchers("/api/v1/meta/**").authenticated();

                    // Reports export: CM only
                    auth.requestMatchers("/api/v1/reports/**").hasRole("CM");

                    // Analytics: CM or FM (scope enforced in service/controller)
                    auth.requestMatchers("/api/v1/analytics/**").hasAnyRole("CM", "FM");

                    // Doctor-route assignments are CM-only (override broader assignments rule)
                    auth.requestMatchers(
                            "/api/v1/assignments/doctor-routes",
                            "/api/v1/assignments/doctor-routes/**"
                    ).hasRole("CM");

                    // Assignments: CM or FM
                    auth.requestMatchers("/api/v1/assignments/**").hasAnyRole("CM", "FM");

                    // MR context
                    auth.requestMatchers("/api/v1/rep/**").hasRole("MR");

                    auth.anyRequest().denyAll();
            });

        // Must-change-password gate
        http.addFilterAfter(new MustChangePasswordFilter(mapper), org.springframework.security.web.csrf.CsrfFilter.class);

        return http.build();
    }
}