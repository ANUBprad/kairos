export function providerDeadline(signal?: AbortSignal | null): AbortSignal {
  const deadline = AbortSignal.timeout(120_000);
  return signal ? AbortSignal.any([signal, deadline]) : deadline;
}

export function createAbortError(message = "Request aborted"): Error {
  const err = new Error(message);
  err.name = "AbortError";
  return err;
}
