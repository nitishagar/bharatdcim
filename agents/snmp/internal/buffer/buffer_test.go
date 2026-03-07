package buffer

import (
	"testing"
	"time"
)

func newTestBuffer(t *testing.T) *Buffer {
	t.Helper()
	buf, err := New(":memory:")
	if err != nil {
		t.Fatalf("failed to create buffer: %v", err)
	}
	t.Cleanup(func() { buf.Close() })
	return buf
}

// SNMP-021: Offline buffering — 60 readings buffered in SQLite
func TestSNMP021_OfflineBuffering(t *testing.T) {
	buf := newTestBuffer(t)

	// Simulate network down: buffer 60 readings
	for i := 0; i < 60; i++ {
		ts := time.Date(2025, 2, 15, 10, i, 0, 0, time.UTC).Format(time.RFC3339)
		err := buf.Insert(Reading{
			MeterID:   "meter-001",
			Timestamp: ts,
			KWh:       float64(100 + i),
			KW:        15.3,
		})
		if err != nil {
			t.Fatalf("insert %d: %v", i, err)
		}
	}

	count, err := buf.Count()
	if err != nil {
		t.Fatal(err)
	}
	if count != 60 {
		t.Errorf("expected 60 buffered readings, got %d", count)
	}

	unsynced, err := buf.UnsyncedCount()
	if err != nil {
		t.Fatal(err)
	}
	if unsynced != 60 {
		t.Errorf("expected 60 unsynced readings, got %d", unsynced)
	}
}

// SNMP-022: Reconnection sync — buffered readings synced to cloud
func TestSNMP022_ReconnectionSync(t *testing.T) {
	buf := newTestBuffer(t)

	// Buffer some readings (offline)
	for i := 0; i < 10; i++ {
		ts := time.Date(2025, 2, 15, 10, i, 0, 0, time.UTC).Format(time.RFC3339)
		err := buf.Insert(Reading{
			MeterID:   "meter-001",
			Timestamp: ts,
			KWh:       float64(100 + i),
		})
		if err != nil {
			t.Fatalf("insert %d: %v", i, err)
		}
	}

	// Simulate reconnection: fetch unsynced
	readings, err := buf.GetUnsynced(1000)
	if err != nil {
		t.Fatal(err)
	}
	if len(readings) != 10 {
		t.Fatalf("expected 10 unsynced, got %d", len(readings))
	}

	// Simulate successful cloud sync: mark as synced
	ids := make([]int64, len(readings))
	for i, r := range readings {
		ids[i] = r.ID
	}
	if err := buf.MarkSynced(ids); err != nil {
		t.Fatal(err)
	}

	// Verify all synced
	unsynced, err := buf.UnsyncedCount()
	if err != nil {
		t.Fatal(err)
	}
	if unsynced != 0 {
		t.Errorf("expected 0 unsynced after sync, got %d", unsynced)
	}

	// Verify still in buffer (not purged yet)
	count, err := buf.Count()
	if err != nil {
		t.Fatal(err)
	}
	if count != 10 {
		t.Errorf("expected 10 total (synced but not purged), got %d", count)
	}
}

// SNMP-B03: GetUnsynced respects limit parameter
func TestSNMPB03_GetUnsyncedRespectsLimit(t *testing.T) {
	buf := newTestBuffer(t)

	for i := 0; i < 10; i++ {
		ts := time.Date(2026, 1, 1, i, 0, 0, 0, time.UTC).Format(time.RFC3339)
		if err := buf.Insert(Reading{MeterID: "m-001", Timestamp: ts, KWh: float64(i)}); err != nil {
			t.Fatalf("insert %d: %v", i, err)
		}
	}

	readings, err := buf.GetUnsynced(3)
	if err != nil {
		t.Fatal(err)
	}
	if len(readings) != 3 {
		t.Errorf("SNMP-B03: expected 3 with limit=3, got %d", len(readings))
	}
	// Verify FIFO: first inserted should come first
	if readings[0].KWh != 0 || readings[1].KWh != 1 || readings[2].KWh != 2 {
		t.Errorf("SNMP-B03: expected readings in FIFO order, got KWh: %v, %v, %v",
			readings[0].KWh, readings[1].KWh, readings[2].KWh)
	}
}

// SNMP-B06: PurgeOlderThan keeps unsynced readings regardless of age
func TestSNMPB06_PurgeOlderThanKeepsUnsyncedReadings(t *testing.T) {
	buf := newTestBuffer(t)

	// Insert an unsynced reading (do NOT mark synced)
	if err := buf.Insert(Reading{
		MeterID:   "m-001",
		Timestamp: "2026-01-01T00:00:00Z",
		KWh:       42,
	}); err != nil {
		t.Fatal(err)
	}

	// Wait to ensure created_at is in the past
	time.Sleep(1100 * time.Millisecond)

	// Purge with duration=0 (everything "older than now")
	purged, err := buf.PurgeOlderThan(0)
	if err != nil {
		t.Fatal(err)
	}
	if purged != 0 {
		t.Errorf("SNMP-B06: expected 0 purged (unsynced must not be deleted), got %d", purged)
	}

	// Verify reading is still there
	count, err := buf.Count()
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Errorf("SNMP-B06: expected 1 reading still present, got %d", count)
	}
}

func TestPurgeOlderThan(t *testing.T) {
	buf := newTestBuffer(t)

	// Insert a reading and mark it synced
	err := buf.Insert(Reading{
		MeterID:   "meter-001",
		Timestamp: "2025-02-15T10:00:00Z",
		KWh:       100,
	})
	if err != nil {
		t.Fatal(err)
	}

	readings, _ := buf.GetUnsynced(10)
	buf.MarkSynced([]int64{readings[0].ID})

	// Wait to ensure created_at timestamp is strictly in the past (RFC3339 second precision)
	time.Sleep(1100 * time.Millisecond)

	// Purge with 0 duration (everything is "older than now")
	purged, err := buf.PurgeOlderThan(0)
	if err != nil {
		t.Fatal(err)
	}
	if purged != 1 {
		t.Errorf("expected 1 purged, got %d", purged)
	}
}
