package sync

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"time"
)

// ReadingPayload is the JSON body for a batch upload.
type ReadingPayload struct {
	MeterID   string  `json:"meter_id"`
	Timestamp string  `json:"timestamp"`
	KWh       float64 `json:"kwh"`
	KW        float64 `json:"kw"`
	PF        float64 `json:"pf"`
}

// HeartbeatPayload is the JSON body for a heartbeat.
type HeartbeatPayload struct {
	AgentVersion string `json:"agent_version"`
	DeviceCount  int    `json:"device_count"`
	UnsyncedCount int64 `json:"unsynced_count"`
	Timestamp    string `json:"timestamp"`
}

// Client handles HTTPS communication with the BharatDCIM cloud API.
type Client struct {
	BaseURL     string
	AuthToken   string
	MaxRetries  int
	HTTPClient  *http.Client
}

// NewClient creates a new sync client.
func NewClient(baseURL, authToken string, maxRetries int) *Client {
	return &Client{
		BaseURL:    baseURL,
		AuthToken:  authToken,
		MaxRetries: maxRetries,
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// UploadReadings sends a batch of readings to the cloud API.
// Returns the number of readings accepted and any error.
func (c *Client) UploadReadings(readings []ReadingPayload) (int, error) {
	body, err := json.Marshal(readings)
	if err != nil {
		return 0, fmt.Errorf("marshal readings: %w", err)
	}

	resp, err := c.doWithRetry("POST", "/api/readings", body)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("upload failed: status %d, body: %s", resp.StatusCode, string(respBody))
	}

	return len(readings), nil
}

// SendHeartbeat sends a heartbeat to the cloud API.
func (c *Client) SendHeartbeat(payload HeartbeatPayload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal heartbeat: %w", err)
	}

	resp, err := c.doWithRetry("POST", "/api/agents/heartbeat", body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("heartbeat failed: status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) doWithRetry(method, path string, body []byte) (*http.Response, error) {
	var lastErr error

	for attempt := 0; attempt <= c.MaxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 1s, 2s, 4s, ...
			backoff := time.Duration(math.Pow(2, float64(attempt-1))) * time.Second
			time.Sleep(backoff)
		}

		req, err := http.NewRequest(method, c.BaseURL+path, bytes.NewReader(body))
		if err != nil {
			return nil, fmt.Errorf("create request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		if c.AuthToken != "" {
			req.Header.Set("Authorization", "Bearer "+c.AuthToken)
		}

		resp, err := c.HTTPClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		// Retry on 5xx
		if resp.StatusCode >= 500 {
			resp.Body.Close()
			lastErr = fmt.Errorf("server error: %d", resp.StatusCode)
			continue
		}

		return resp, nil
	}

	return nil, fmt.Errorf("max retries exceeded: %w", lastErr)
}
