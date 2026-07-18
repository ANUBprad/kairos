FROM golang:1.26 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY gateway/templates /app/templates
COPY gateway/static /app/static
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o kairos-gateway ./gateway

FROM gcr.io/distroless/static-debian12
COPY --from=builder /app/kairos-gateway /app/kairos-gateway
COPY --from=builder /app/templates /app/templates
COPY --from=builder /app/static /app/static
ENTRYPOINT ["/app/kairos-gateway"]
