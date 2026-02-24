package sync

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

// SNMP-023: Heartbeat — heartbeat every 60s with device count
func TestSNMP023_Heartbeat(t *testing.T) {
	var received atomic.Bool
	var heartbeat HeartbeatPayload

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/agents/heartbeat" {
			t.Errorf("unexpected path: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Error("missing or wrong auth token")
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		if err := json.NewDecoder(r.Body).Decode(&heartbeat); err != nil {
			t.Errorf("decode body: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		received.Store(true)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-token", 0)

	err := client.SendHeartbeat(HeartbeatPayload{
		AgentVersion:  "0.1.0",
		DeviceCount:   5,
		UnsyncedCount: 42,
		Timestamp:     "2025-02-15T10:00:00Z",
	})
	if err != nil {
		t.Fatalf("heartbeat failed: %v", err)
	}

	if !received.Load() {
		t.Fatal("heartbeat was not received by server")
	}
	if heartbeat.DeviceCount != 5 {
		t.Errorf("expected device_count=5, got %d", heartbeat.DeviceCount)
	}
	if heartbeat.UnsyncedCount != 42 {
		t.Errorf("expected unsynced_count=42, got %d", heartbeat.UnsyncedCount)
	}
}

// SNMP-020: Timeout retry — 3 retries with exponential backoff
func TestSNMP020_TimeoutRetry(t *testing.T) {
	var attempts atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := attempts.Add(1)
		if count <= 3 {
			// Simulate server error for first 3 attempts
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		// 4th attempt succeeds
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-token", 3)
	// Override HTTP client timeout for fast test
	client.HTTPClient.Timeout = 1 * 1000000000 // 1s

	err := client.SendHeartbeat(HeartbeatPayload{
		AgentVersion: "0.1.0",
		DeviceCount:  1,
		Timestamp:    "2025-02-15T10:00:00Z",
	})
	if err != nil {
		t.Fatalf("expected success after retries, got: %v", err)
	}

	if attempts.Load() != 4 {
		t.Errorf("expected 4 attempts (1 initial + 3 retries), got %d", attempts.Load())
	}
}

func TestUploadReadings(t *testing.T) {
	var receivedCount int

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var readings []ReadingPayload
		if err := json.NewDecoder(r.Body).Decode(&readings); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		receivedCount = len(readings)
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-token", 0)
	count, err := client.UploadReadings([]ReadingPayload{
		{MeterID: "m-001", Timestamp: "2025-02-15T10:00:00Z", KWh: 100},
		{MeterID: "m-001", Timestamp: "2025-02-15T11:00:00Z", KWh: 110},
	})
	if err != nil {
		t.Fatalf("upload failed: %v", err)
	}
	if count != 2 {
		t.Errorf("expected 2 accepted, got %d", count)
	}
	if receivedCount != 2 {
		t.Errorf("server received %d readings, expected 2", receivedCount)
	}
}
