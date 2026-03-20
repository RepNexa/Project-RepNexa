package com.repnexa.modules.reports.common;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CsvWriterTest {

    @Test
    void withUtf8Bom_onlyWritesBomOnce_even_if_called_twice() {
        byte[] bytes = new CsvWriter()
                .withUtf8Bom()
                .withUtf8Bom()
                .row("A", "B")
                .toBytes();

        byte[] bom = new byte[] {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        assertArrayEquals(bom, new byte[] {bytes[0], bytes[1], bytes[2]});
        String csv = new String(bytes, StandardCharsets.UTF_8);
        assertTrue(csv.startsWith("\uFEFFA,B"));
        assertEquals(1, csv.chars().filter(ch -> ch == '\uFEFF').count());
    }

    @Test
    void row_escapes_commas_quotes_and_newlines() {
        String csv = new String(new CsvWriter()
                .row("plain", "with,comma", "say \"hi\"", "line1\nline2")
                .toBytes(), StandardCharsets.UTF_8);

        assertEquals("plain,\"with,comma\",\"say \"\"hi\"\"\",\"line1\nline2\"", csv);
    }

    @Test
    void null_cells_become_empty_strings() {
        String csv = new String(new CsvWriter()
                .row("A", null, 42)
                .toBytes(), StandardCharsets.UTF_8);

        assertEquals("A,,42", csv);
    }
}
