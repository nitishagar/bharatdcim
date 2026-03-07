package sync

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// SNMP-S01: UploadReadings sends POST to /readings/batch with correct JSON body
func TestSNMPS01_UploadReadingsBatchPath(t *testing.T) {
	var gotPath string
	var gotMethod string
	var gotBody []ReadingPayload

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotMethod = r.Method
		if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	client := NewClient(server.URL, "tok", 0)
	_, err := client.UploadReadings([]ReadingPayload{
		{MeterID: "m-001", Timestamp: "2026-01-01T00:00:00Z", KWh: 100},
	})
	if err != nil {
		t.Fatalf("UploadReadings failed: %v", err)
	}

	if gotMethod != "POST" {
		t.Errorf("SNMP-S01: expected POST, got %s", gotMethod)
	}
	if gotPath != "/readings/batch" {
		t.Errorf("SNMP-S01: expected path /readings/batch, got %s", gotPath)
	}
	if len(gotBody) != 1 || gotBody[0].MeterID != "m-001" {
		t.Errorf("SNMP-S01: unexpected body: %v", gotBody)
	}
}

// SNMP-S02: UploadReadings includes Authorization header when AuthToken is set
func TestSNMPS02_UploadReadingsAuthHeader(t *testing.T) {
	var gotAuth string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	client := NewClient(server.URL, "my-secret-token", 0)
	_, err := client.UploadReadings([]ReadingPayload{
		{MeterID: "m-001", Timestamp: "2026-01-01T00:00:00Z", KWh: 50},
	})
	if err != nil {
		t.Fatalf("UploadReadings failed: %v", err)
	}

	expected := "Bearer my-secret-token"
	if gotAuth != expected {
		t.Errorf("SNMP-S02: expected Authorization=%q, got %q", expected, gotAuth)
	}
}

// SNMP-S03: UploadReadings returns count of readings uploaded
func TestSNMPS03_UploadReadingsCount(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	client := NewClient(server.URL, "", 0)
	readings := []ReadingPayload{
		{MeterID: "m-001", Timestamp: "2026-01-01T00:00:00Z", KWh: 100},
		{MeterID: "m-001", Timestamp: "2026-01-01T01:00:00Z", KWh: 110},
		{MeterID: "m-001", Timestamp: "2026-01-01T02:00:00Z", KWh: 120},
	}

	count, err := client.UploadReadings(readings)
	if err != nil {
		t.Fatalf("UploadReadings failed: %v", err)
	}
	if count != 3 {
		t.Errorf("SNMP-S03: expected count=3, got %d", count)
	}
}

// SNMP-S04: UploadReadings retries on 500 with exponential backoff
func TestSNMPS04_UploadReadingsRetriesOn500(t *testing.T) {
	var attempts atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := attempts.Add(1)
		if n <= 2 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	client := NewClient(server.URL, "", 2)
	client.HTTPClient.Timeout = 1 * time.Second // speed up test

	_, err := client.UploadReadings([]ReadingPayload{
		{MeterID: "m-001", Timestamp: "2026-01-01T00:00:00Z", KWh: 100},
	})
	if err != nil {
		t.Fatalf("SNMP-S04: expected success after retries, got: %v", err)
	}
	if attempts.Load() != 3 {
		t.Errorf("SNMP-S04: expected 3 attempts (1 + 2 retries), got %d", attempts.Load())
	}
}

// SNMP-S05: UploadReadings does not retry on 400
func TestSNMPS05_UploadReadingsNoRetryOn400(t *testing.T) {
	var attempts atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts.Add(1)
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"bad request"}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "", 3) // 3 retries allowed but should not retry 400
	_, err := client.UploadReadings([]ReadingPayload{
		{MeterID: "m-001", Timestamp: "2026-01-01T00:00:00Z", KWh: 100},
	})
	if err == nil {
		t.Error("SNMP-S05: expected error on 400, got nil")
	}
	if attempts.Load() != 1 {
		t.Errorf("SNMP-S05: expected exactly 1 attempt (no retry on 400), got %d", attempts.Load())
	}
}

// SNMP-S06: SendHeartbeat sends POST to /agents/heartbeat with agent_id in body
func TestSNMPS06_SendHeartbeatCorrectPathAndAgentID(t *testing.T) {
	var gotPath string
	var gotBody HeartbeatPayload

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewClient(server.URL, "tok", 0)
	err := client.SendHeartbeat(HeartbeatPayload{
		AgentID:      "agent-001",
		AgentVersion: "0.1.0",
		DeviceCount:  3,
		Timestamp:    "2026-01-01T00:00:00Z",
	})
	if err != nil {
		t.Fatalf("SNMP-S06: SendHeartbeat failed: %v", err)
	}
	if gotPath != "/agents/heartbeat" {
		t.Errorf("SNMP-S06: expected path /agents/heartbeat, got %s", gotPath)
	}
	if gotBody.AgentID != "agent-001" {
		t.Errorf("SNMP-S06: expected agent_id=agent-001, got %q", gotBody.AgentID)
	}
}

// SNMP-S07: SendHeartbeat includes tenant_id when configured
func TestSNMPS07_SendHeartbeatIncludesTenantID(t *testing.T) {
	var gotBody HeartbeatPayload

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewClient(server.URL, "", 0)
	err := client.SendHeartbeat(HeartbeatPayload{
		AgentID:      "agent-001",
		AgentVersion: "0.1.0",
		DeviceCount:  1,
		TenantID:     "tenant-mh",
		Timestamp:    "2026-01-01T00:00:00Z",
	})
	if err != nil {
		t.Fatalf("SNMP-S07: failed: %v", err)
	}
	if gotBody.TenantID != "tenant-mh" {
		t.Errorf("SNMP-S07: expected tenant_id=tenant-mh, got %q", gotBody.TenantID)
	}
}

// SNMP-S08: SendHeartbeat omits tenant_id when empty (omitempty)
func TestSNMPS08_SendHeartbeatOmitsTenantIDWhenEmpty(t *testing.T) {
	var rawBody map[string]interface{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&rawBody)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewClient(server.URL, "", 0)
	err := client.SendHeartbeat(HeartbeatPayload{
		AgentID:      "agent-001",
		AgentVersion: "0.1.0",
		DeviceCount:  1,
		TenantID:     "", // empty — should be omitted via omitempty
		Timestamp:    "2026-01-01T00:00:00Z",
	})
	if err != nil {
		t.Fatalf("SNMP-S08: failed: %v", err)
	}
	if _, found := rawBody["tenant_id"]; found {
		t.Error("SNMP-S08: tenant_id should be omitted when empty, but was present in JSON")
	}
}

// SNMP-S09: NewClient sets 30s HTTP timeout
func TestSNMPS09_NewClientSets30sTimeout(t *testing.T) {
	client := NewClient("http://localhost", "tok", 3)
	if client.HTTPClient.Timeout != 30*time.Second {
		t.Errorf("SNMP-S09: expected 30s timeout, got %v", client.HTTPClient.Timeout)
	}
}
