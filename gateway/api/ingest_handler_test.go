package api

import (
	"Kairos/gateway/httpWriter"
	"Kairos/gateway/queue"
	pb "Kairos/generated/go/proto"
	"bytes"
	"context"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"google.golang.org/grpc"
)

type fakeIntelClient struct{}

var _ pb.IntelligenceServiceClient = (*fakeIntelClient)(nil)

func (c *fakeIntelClient) ComputeEmbeddings(ctx context.Context, in *pb.ComputeEmbeddingRequest, opts ...grpc.CallOption) (*pb.ComputeEmbeddingResponse, error) {
	return &pb.ComputeEmbeddingResponse{}, nil
}

func (c *fakeIntelClient) ClassifyQueryType(ctx context.Context, in *pb.ClassifyQueryRequest, opts ...grpc.CallOption) (*pb.ClassifyQueryResponse, error) {
	return &pb.ClassifyQueryResponse{}, nil
}

func (c *fakeIntelClient) IngestDocument(ctx context.Context, in *pb.IngestDocumentRequest, opts ...grpc.CallOption) (*pb.IngestDocumentResponse, error) {
	return &pb.IngestDocumentResponse{}, nil
}

func (c *fakeIntelClient) ExecuteRetrieval(ctx context.Context, in *pb.ExecuteRetrievalRequest, opts ...grpc.CallOption) (*pb.ExecuteRetrievalResponse, error) {
	return &pb.ExecuteRetrievalResponse{}, nil
}

func (c *fakeIntelClient) GenerateResponse(ctx context.Context, in *pb.GenerateResponseRequest, opts ...grpc.CallOption) (*pb.GeneratedResponse, error) {
	return &pb.GeneratedResponse{}, nil
}

func newTestIngestHandler(maxSizeMB int32) *IngestHandler {
	tracker := queue.NewJobTracker()
	client := &fakeIntelClient{}
	ingestion := queue.NewIngestionQueue(context.Background(), tracker, client)
	return &IngestHandler{
		tracker:   tracker,
		ingestion: ingestion,
		maxSize:   maxSizeMB,
	}
}

func buildMultipartBody(t *testing.T, filename string, contentType string, content []byte) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	headers := make(map[string][]string)
	headers["Content-Disposition"] = []string{
		`form-data; name="file"; filename="` + filename + `"`,
	}
	if contentType != "" {
		headers["Content-Type"] = []string{contentType}
	}
	part, err := writer.CreatePart(headers)
	if err != nil {
		t.Fatalf("CreatePart: %v", err)
	}
	part.Write(content)
	if err := writer.WriteField("chunking_strategy", "0"); err != nil {
		t.Fatalf("WriteField: %v", err)
	}
	writer.Close()
	return body, writer.FormDataContentType()
}

func ingestRequest(t *testing.T, body *bytes.Buffer, contentType string) *httptest.ResponseRecorder {
	t.Helper()
	handler := newTestIngestHandler(1)
	req := httptest.NewRequest(http.MethodPost, "/ingest", body)
	req.Header.Set("Content-Type", contentType)
	req = req.WithContext(context.WithValue(req.Context(), httpWriter.NamespaceKey{}, "testnamespace"))

	recorder := httptest.NewRecorder()
	handler.IngestUserDoc(recorder, req)
	return recorder
}

func TestIngestAcceptsValidUpload(t *testing.T) {
	body, contentType := buildMultipartBody(t, "doc.pdf", "application/pdf", []byte("hello world"))
	recorder := ingestRequest(t, body, contentType)
	if recorder.Code != http.StatusOK {
		t.Errorf("expected status 200 for valid upload, got %d (body: %s)", recorder.Code, recorder.Body.String())
	}
}

func TestIngestRejectsOversizedUpload(t *testing.T) {
	handler := newTestIngestHandler(1) // 1 MiB limit
	content := make([]byte, 2*1024*1024)
	for i := range content {
		content[i] = byte('a')
	}
	body, contentType := buildMultipartBody(t, "big.pdf", "application/pdf", content)

	req := httptest.NewRequest(http.MethodPost, "/ingest", body)
	req.Header.Set("Content-Type", contentType)
	req = req.WithContext(context.WithValue(req.Context(), httpWriter.NamespaceKey{}, "testnamespace"))

	recorder := httptest.NewRecorder()
	handler.IngestUserDoc(recorder, req)

	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("expected status 413 for oversized upload, got %d", recorder.Code)
	}
}

func TestIngestRejectsUnsupportedContentType(t *testing.T) {
	body, contentType := buildMultipartBody(t, "evil.exe", "application/x-msdownload", []byte("MZ"))
	recorder := ingestRequest(t, body, contentType)
	if recorder.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for unsupported content type, got %d", recorder.Code)
	}
}
