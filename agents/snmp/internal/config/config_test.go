package config

import (
	"os"
	"testing"
)

// writeConfig writes YAML content to a temp file and returns the path.
func writeConfig(t *testing.T, content string) string {
	t.Helper()
	f, err := os.CreateTemp("", "snmp-agent-*.yaml")
	if err != nil {
		t.Fatalf("create temp file: %v", err)
	}
	t.Cleanup(func() { os.Remove(f.Name()) })
	if _, err := f.WriteString(content); err != nil {
		t.Fatalf("write temp file: %v", err)
	}
	f.Close()
	return f.Name()
}

const validYAML = `
agent:
  poll_interval_sec: 30
  buffer_db_path: /tmp/test.db

cloud:
  api_base_url: https://api.example.com
  auth_token: secret-token
  agent_id: agent-dc-001
  tenant_id: tenant-mh
  heartbeat_sec: 60
  sync_batch_size: 500
  retry_max_attempts: 5

devices:
  - name: PDU-APC-01
    host: 192.168.1.100
    port: 161
    community: public
    vendor: apc
    meter_id: meter-001
    counter_size: 32
`

// SNMP-C01: Load parses valid YAML with all fields
func TestSNMPC01_LoadParsesValidYAML(t *testing.T) {
	path := writeConfig(t, validYAML)
	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("SNMP-C01: unexpected error: %v", err)
	}
	if cfg.Agent.PollIntervalSec != 30 {
		t.Errorf("SNMP-C01: expected poll_interval_sec=30, got %d", cfg.Agent.PollIntervalSec)
	}
	if cfg.Cloud.APIBaseURL != "https://api.example.com" {
		t.Errorf("SNMP-C01: expected api_base_url, got %q", cfg.Cloud.APIBaseURL)
	}
	if cfg.Cloud.AgentID != "agent-dc-001" {
		t.Errorf("SNMP-C01: expected agent_id=agent-dc-001, got %q", cfg.Cloud.AgentID)
	}
	if cfg.Cloud.TenantID != "tenant-mh" {
		t.Errorf("SNMP-C01: expected tenant_id=tenant-mh, got %q", cfg.Cloud.TenantID)
	}
	if len(cfg.Devices) != 1 {
		t.Errorf("SNMP-C01: expected 1 device, got %d", len(cfg.Devices))
	}
	if cfg.Devices[0].MeterID != "meter-001" {
		t.Errorf("SNMP-C01: expected meter_id=meter-001, got %q", cfg.Devices[0].MeterID)
	}
}

// SNMP-C02: Load applies defaults for omitted optional fields
func TestSNMPC02_LoadAppliesDefaults(t *testing.T) {
	minimalYAML := `
cloud:
  api_base_url: https://api.example.com
  agent_id: agent-001

devices:
  - host: 192.168.1.1
    vendor: apc
    meter_id: meter-001
`
	path := writeConfig(t, minimalYAML)
	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("SNMP-C02: unexpected error: %v", err)
	}
	if cfg.Agent.PollIntervalSec != 60 {
		t.Errorf("SNMP-C02: default poll_interval_sec should be 60, got %d", cfg.Agent.PollIntervalSec)
	}
	if cfg.Cloud.HeartbeatSec != 60 {
		t.Errorf("SNMP-C02: default heartbeat_sec should be 60, got %d", cfg.Cloud.HeartbeatSec)
	}
	if cfg.Cloud.SyncBatchSize != 1000 {
		t.Errorf("SNMP-C02: default sync_batch_size should be 1000, got %d", cfg.Cloud.SyncBatchSize)
	}
	if cfg.Cloud.RetryMaxAttempts != 3 {
		t.Errorf("SNMP-C02: default retry_max_attempts should be 3, got %d", cfg.Cloud.RetryMaxAttempts)
	}
}

// SNMP-C03: Load fails on missing devices
func TestSNMPC03_LoadFailsMissingDevices(t *testing.T) {
	yaml := `
cloud:
  api_base_url: https://api.example.com
  agent_id: agent-001
`
	path := writeConfig(t, yaml)
	_, err := Load(path)
	if err == nil {
		t.Error("SNMP-C03: expected error for missing devices, got nil")
	}
}

// SNMP-C04: Load fails on device missing host
func TestSNMPC04_LoadFailsDeviceMissingHost(t *testing.T) {
	yaml := `
cloud:
  api_base_url: https://api.example.com
  agent_id: agent-001

devices:
  - vendor: apc
    meter_id: meter-001
`
	path := writeConfig(t, yaml)
	_, err := Load(path)
	if err == nil {
		t.Error("SNMP-C04: expected error for device missing host, got nil")
	}
}

// SNMP-C05: Load fails on device missing vendor
func TestSNMPC05_LoadFailsDeviceMissingVendor(t *testing.T) {
	yaml := `
cloud:
  api_base_url: https://api.example.com
  agent_id: agent-001

devices:
  - host: 192.168.1.1
    meter_id: meter-001
`
	path := writeConfig(t, yaml)
	_, err := Load(path)
	if err == nil {
		t.Error("SNMP-C05: expected error for device missing vendor, got nil")
	}
}

// SNMP-C06: Load fails on device missing meter_id
func TestSNMPC06_LoadFailsDeviceMissingMeterID(t *testing.T) {
	yaml := `
cloud:
  api_base_url: https://api.example.com
  agent_id: agent-001

devices:
  - host: 192.168.1.1
    vendor: apc
`
	path := writeConfig(t, yaml)
	_, err := Load(path)
	if err == nil {
		t.Error("SNMP-C06: expected error for device missing meter_id, got nil")
	}
}

// SNMP-C07: Load fails on missing agent_id in cloud config
func TestSNMPC07_LoadFailsMissingAgentID(t *testing.T) {
	yaml := `
cloud:
  api_base_url: https://api.example.com
  # agent_id is intentionally missing

devices:
  - host: 192.168.1.1
    vendor: apc
    meter_id: meter-001
`
	path := writeConfig(t, yaml)
	_, err := Load(path)
	if err == nil {
		t.Error("SNMP-C07: expected error for missing cloud.agent_id, got nil")
	}
}

// SNMP-C08: Default poll_interval_sec is 60
func TestSNMPC08_DefaultPollIntervalIs60(t *testing.T) {
	yaml := `
cloud:
  api_base_url: https://api.example.com
  agent_id: agent-001

devices:
  - host: 192.168.1.1
    vendor: apc
    meter_id: meter-001
`
	path := writeConfig(t, yaml)
	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("SNMP-C08: unexpected error: %v", err)
	}
	if cfg.Agent.PollIntervalSec != 60 {
		t.Errorf("SNMP-C08: expected default poll_interval_sec=60, got %d", cfg.Agent.PollIntervalSec)
	}
}

// SNMP-C09: Default community is "public"
func TestSNMPC09_DefaultCommunityIsPublic(t *testing.T) {
	yaml := `
cloud:
  api_base_url: https://api.example.com
  agent_id: agent-001

devices:
  - host: 192.168.1.1
    vendor: apc
    meter_id: meter-001
    # community intentionally omitted
`
	path := writeConfig(t, yaml)
	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("SNMP-C09: unexpected error: %v", err)
	}
	if cfg.Devices[0].Community != "public" {
		t.Errorf("SNMP-C09: expected default community=public, got %q", cfg.Devices[0].Community)
	}
}

// SNMP-C10: Default counter_size is 32
func TestSNMPC10_DefaultCounterSizeIs32(t *testing.T) {
	yaml := `
cloud:
  api_base_url: https://api.example.com
  agent_id: agent-001

devices:
  - host: 192.168.1.1
    vendor: apc
    meter_id: meter-001
    # counter_size intentionally omitted
`
	path := writeConfig(t, yaml)
	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("SNMP-C10: unexpected error: %v", err)
	}
	if cfg.Devices[0].CounterSize != 32 {
		t.Errorf("SNMP-C10: expected default counter_size=32, got %d", cfg.Devices[0].CounterSize)
	}
}
