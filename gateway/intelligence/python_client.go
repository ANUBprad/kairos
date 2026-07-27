package intelligence

import (
	"Kairos/gateway/config"
	"Kairos/gateway/middleware"
	pb "Kairos/generated/go/proto"
	"context"
	"log/slog"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

// injectTraceContext adds the X-Trace-ID from the HTTP request context to gRPC metadata
// so it propagates across service boundaries for distributed tracing.
func injectTraceContext(ctx context.Context) context.Context {
	traceID := middleware.GetTraceID(ctx)
	if traceID == "" {
		return ctx
	}
	return metadata.AppendToOutgoingContext(ctx, "x-trace-id", traceID)
}

func ConnectToPython(envVar *config.Config) (pb.IntelligenceServiceClient, *grpc.ClientConn, error) {

	host := envVar.Intelligence.Host
	port := envVar.Intelligence.Port

	target := host + ":" + port

	conn, err := grpc.NewClient(target, grpc.WithTransportCredentials(insecure.NewCredentials()))

	if err != nil {
		slog.Error("Couldn't establish connection with python server", "ERROR", err)
		return nil, nil, err
	}

	client := pb.NewIntelligenceServiceClient(conn)
	return client, conn, nil
}

func ClassifyQuery(ctx context.Context, client pb.IntelligenceServiceClient, query string, namespace string) (*pb.ClassifyQueryResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	ctx = injectTraceContext(ctx)

	req := &pb.ClassifyQueryRequest{
		UserQuery: query,
		Namespace: namespace,
	}
	res, err := client.ClassifyQueryType(ctx, req)
	if err != nil {
		slog.Error("Couldn't classify Query", "ERROR", err)
		return nil, err
	}

	return res, nil
}

func ComputeEmbeddings(ctx context.Context, client pb.IntelligenceServiceClient, query string) ([]float32, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	ctx = injectTraceContext(ctx)

	req := &pb.ComputeEmbeddingRequest{
		UserQuery: query,
	}

	res, err := client.ComputeEmbeddings(ctx, req)
	if err != nil {
		slog.Error("Couldn't Compute Embeddings", "ERROR", err)
		return nil, err
	}

	return res.VectorEmbeddings, nil
}

func ExecuteRetrieval(ctx context.Context, client pb.IntelligenceServiceClient, query string, config *pb.RetrievalConfig, namespace string) (*pb.ExecuteRetrievalResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	ctx = injectTraceContext(ctx)

	req := &pb.ExecuteRetrievalRequest{
		UserQuery:      query,
		ReceivedConfig: config,
		Namespace:      namespace,
	}

	res, err := client.ExecuteRetrieval(ctx, req)
	if err != nil {
		slog.Error("Couldn't connect to ExecuteRetrieval", "ERROR", err)
		return nil, err
	}

	return res, nil
}

func GenerateResponse(ctx context.Context, client pb.IntelligenceServiceClient, namespace string, query string, retrieved_chunk []*pb.RetrievedChunk) (*pb.GeneratedResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	ctx = injectTraceContext(ctx)

	req := &pb.GenerateResponseRequest{
		Namespace:      namespace,
		UserQuery:      query,
		RetrievedChunk: retrieved_chunk,
	}

	res, err := client.GenerateResponse(ctx, req)
	if err != nil {
		slog.Error("Couldn't connect to GenerateResponse", "ERROR", err)
		return nil, err
	}

	return res, nil
}

func IngestDocument(ctx context.Context, client pb.IntelligenceServiceClient, mime_type string, chunking_strat int32, namespace string, filename string, content []byte) (*pb.IngestDocumentResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	ctx = injectTraceContext(ctx)

	req := &pb.IngestDocumentRequest{
		DocContent:       content,
		Namespace:        namespace,
		Filename:         filename,
		MimeType:         mime_type,
		ChunkingStrategy: pb.ChunkingStrategy(chunking_strat),
	}

	res, err := client.IngestDocument(ctx, req)
	if err != nil {
		slog.Error("Couldn't connect to IngestDocument", "ERROR", err)
		return nil, err
	}
	return res, nil
}
