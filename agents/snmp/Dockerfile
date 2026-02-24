FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -o /snmp-agent ./cmd/agent

FROM alpine:3.21
RUN apk add --no-cache sqlite-libs
COPY --from=builder /snmp-agent /usr/local/bin/snmp-agent
ENTRYPOINT ["snmp-agent"]
