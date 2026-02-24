.PHONY: all build test lint clean

all: build test lint

build:
	CGO_ENABLED=1 go build -o bin/snmp-agent ./cmd/agent

test:
	CGO_ENABLED=1 go test ./... -v -count=1

lint:
	go vet ./...

clean:
	rm -rf bin/

docker:
	docker build -t bharatdcim-snmp-agent .
