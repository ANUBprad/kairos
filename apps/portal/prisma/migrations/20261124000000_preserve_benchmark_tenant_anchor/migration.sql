-- Null knowledgeBaseId means intentionally global benchmark material.
-- Preserve tenant anchors until their datasets are explicitly deleted.
ALTER TABLE "BenchmarkDataset"
  DROP CONSTRAINT "BenchmarkDataset_knowledgeBaseId_fkey",
  ADD CONSTRAINT "BenchmarkDataset_knowledgeBaseId_fkey"
    FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
