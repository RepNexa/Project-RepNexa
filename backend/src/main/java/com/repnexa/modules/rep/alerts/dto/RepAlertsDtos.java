package com.repnexa.modules.rep.alerts.dto;

import java.time.OffsetDateTime;
import java.util.List;

public final class RepAlertsDtos {

    private RepAlertsDtos() {}

    public record MasterDataAlertsResponse(
            long routeId,
            List<Item> items
    ) {}

    public record Item(
            String entityType,
            long entityId,
            String title,
            String changeKind,
            OffsetDateTime changedAt,
            String subtitle
    ) {}
}