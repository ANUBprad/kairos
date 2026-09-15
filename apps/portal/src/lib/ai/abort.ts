export function createAbortError(message = "Request aborted"): Error {
  const err = new Error(message);
  err.name = "AbortError";
  return err;
}