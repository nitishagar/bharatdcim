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
