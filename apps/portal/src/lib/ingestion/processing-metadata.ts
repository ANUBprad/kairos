// Pipeline metadata is additive: a failed run must not erase facts that later
// UI (preview, MIME hints, extraction stats) still needs. Only the failure keys
// and the current run's stage keys are replaced.
export function mergeFailureMetadata(
  previous: Record<string, unknown> | null | undefined,
  pipeline: Record<string, unknown>,
  error: string,
  now: Date = new Date(),
): Record<string, unknown> {
  return {
    ...(previous ?? {}),
    ...pipeline,
    lastProcessError: error,
    lastProcessFailedAt: now.toISOString(),
  };
}
