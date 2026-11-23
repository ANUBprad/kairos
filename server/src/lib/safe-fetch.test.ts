import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSafePublicHttpUrl,
  safeFetchBuffer,
  type BodyReader,
  type FetchDeps,
  type PinnedRequestOptions,
  type RequestLike,
  type ResponseLike,
  type SocketLike,
} from "./safe-fetch.js";
import { ValidationError } from "../types/app-error.js";

type Listener = (...args: unknown[]) => void;

class FakeSocket implements SocketLike {
  remoteAddress?: string;
  destroyed = false;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(remoteAddress?: string) {
    this.remoteAddress = remoteAddress;
  }

  on(event: string, listener: Listener): this {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }

  destroy(): void {
    this.destroyed = true;
  }
}

interface FakeResponseInit {
  status?: number;
  headers?: Record<string, string>;
  chunks?: Array<string | Uint8Array>;
  socket?: FakeSocket;
}

function fakeResponse(init: FakeResponseInit = {}): ResponseLike {
  const headers = new Map(
    Object.entries(init.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  );
  const chunks = (init.chunks ?? []).map((chunk) =>
    typeof chunk === "string" ? Buffer.from(chunk) : chunk,
  );
  const reader: BodyReader = {
    async read() {
      const next = chunks.shift();
      return next ? { done: false, value: next } : { done: true };
    },
    async cancel() {},
  };
  return {
    status: init.status ?? 200,
    headers: { get: (name) => headers.get(name.toLowerCase()) ?? null },
    body: { getReader: () => reader },
    socket: init.socket,
  };
}

class FakeRequest implements RequestLike {
  readonly listeners = new Map<string, Listener[]>();
  ended = false;
  destroyed = false;

  constructor(
    private readonly response: ResponseLike,
    private readonly socket?: FakeSocket,
    readonly options?: PinnedRequestOptions,
  ) {}

  on(event: string, listener: Listener): this {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }

  end(): void {
    this.ended = true;
    if (this.socket) this.emit("socket", this.socket);
    this.emit("response", this.response);
  }

  destroy(): void {
    this.destroyed = true;
  }
}

class ErrorRequest extends FakeRequest {
  constructor(private readonly error: Error) {
    super(fakeResponse());
  }

  override end(): void {
    this.emit("error", this.error);
  }
}

class HangingRequest extends FakeRequest {
  constructor() {
    super(fakeResponse());
  }

  override end(): void {}
}

interface RecordingDeps extends FetchDeps {
  lookupCalls: Array<{ hostname: string; options: { all: true } }>;
  requestOptions: PinnedRequestOptions[];
  requests: RequestLike[];
}

function recordingDeps(
  responses: Array<FakeResponseInit | ((options: PinnedRequestOptions, index: number) => RequestLike)>,
  lookupImpl: NonNullable<FetchDeps["lookup"]> = async () => [{ address: "93.184.216.34", family: 4 }],
): RecordingDeps {
  const lookupCalls: RecordingDeps["lookupCalls"] = [];
  const requestOptions: PinnedRequestOptions[] = [];
  const requests: RequestLike[] = [];
  let index = 0;
  return {
    lookupCalls,
    requestOptions,
    requests,
    lookup: async (hostname, opts) => {
      lookupCalls.push({ hostname, options: opts });
      return lookupImpl(hostname, opts);
    },
    requestFactory: (_url, options) => {
      requestOptions.push(options);
      const current = index;
      index += 1;
      const entry = responses[Math.min(current, responses.length - 1)] ?? {};
      const request =
        typeof entry === "function"
          ? entry(options, current)
          : new FakeRequest(fakeResponse(entry), entry.socket, options);
      requests.push(request);
      return request;
    },
  };
}

async function rejectsValidation(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ValidationError, `expected ValidationError, got ${String(error)}`);
    assert.match(error.message, pattern);
    return true;
  });
}

function pinnedFromRequestOptions(options: PinnedRequestOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    options.lookup("attacker-controlled.example", { all: false }, (error, address, family) => {
      if (error) {
        reject(error);
        return;
      }
      assert.equal(family, 4);
      resolve(Array.isArray(address) ? address[0].address : String(address));
    });
  });
}

describe("safe outbound fetch", () => {
  it("rejects non-http schemes, embedded credentials, and odd ports", async () => {
    await rejectsValidation(assertSafePublicHttpUrl("file:///etc/passwd"), /Only http and https/);
    await rejectsValidation(assertSafePublicHttpUrl("ftp://example.com/"), /Only http and https/);
    await rejectsValidation(
      assertSafePublicHttpUrl("https://user:pass@example.com/"),
      /embedded credentials/,
    );
    await rejectsValidation(
      assertSafePublicHttpUrl("http://example.com:8080/"),
      /port is not allowed/,
    );
    await rejectsValidation(assertSafePublicHttpUrl("http://localhost/"), /host is not permitted/);
    await rejectsValidation(
      assertSafePublicHttpUrl("http://metadata.google.internal/"),
      /host is not permitted/,
    );
  });

  it("accepts a public DNS result and pins it to the connection", async () => {
    const socket = new FakeSocket("93.184.216.34");
    const deps = recordingDeps([
      {
        headers: { "content-type": "text/plain" },
        chunks: ["ok"],
        socket,
      },
    ]);
    const result = await safeFetchBuffer(
      "http://example.com/file.txt",
      { allowedContentTypes: ["text/plain"] },
      deps,
    );

    assert.equal(result.buffer.toString(), "ok");
    assert.equal(result.contentType, "text/plain");
    assert.equal(result.finalUrl, "http://example.com/file.txt");
    assert.equal(deps.lookupCalls.length, 1);
    assert.equal(deps.lookupCalls[0].hostname, "example.com");
    assert.deepEqual(deps.lookupCalls[0].options, { all: true });
    const options = deps.requestOptions[0];
    assert.equal(options.pinnedAddress, "93.184.216.34");
    assert.equal(options.pinnedFamily, 4);
    assert.equal(options.hostname, "example.com");
    assert.equal(options.headers.host, "example.com");
    assert.equal(await pinnedFromRequestOptions(options), "93.184.216.34");
    assert.equal(socket.destroyed, false);
  });

  it("rejects private, loopback, link-local, and metadata addresses", async () => {
    for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "192.0.2.1"]) {
      await rejectsValidation(
        assertSafePublicHttpUrl(`http://${ip}/`),
        /permitted public address/,
      );
      await rejectsValidation(
        assertSafePublicHttpUrl("http://bad.example/", {
          lookup: async () => [{ address: ip, family: 4 }],
        }),
        /permitted public address/,
      );
    }
    for (const ip of ["::1", "fc00::1", "fe80::1", "2001:db8::1"]) {
      await rejectsValidation(
        assertSafePublicHttpUrl(`http://[${ip}]/`),
        /permitted public address/,
      );
      await rejectsValidation(
        assertSafePublicHttpUrl("http://bad.example/", {
          lookup: async () => [{ address: ip, family: 6 }],
        }),
        /permitted public address/,
      );
    }
  });

  it("rejects IPv4-mapped IPv6 and alternate numeric IPv4 forms", async () => {
    for (const host of ["[::ffff:127.0.0.1]", "[::ffff:7f00:1]", "2130706433", "0x7f000001"]) {
      await rejectsValidation(
        assertSafePublicHttpUrl(`http://${host}/`),
        /permitted public address/,
      );
    }
    await rejectsValidation(
      assertSafePublicHttpUrl("http://good.example/", {
        lookup: async () => [{ address: "::ffff:7f00:1", family: 6 }],
      }),
      /permitted public address/,
    );
  });

  it("pins the validated IP once per hop even if the socket resolver would rebind", async () => {
    let validationLookups = 0;
    const deps = recordingDeps(
      [{ headers: { "content-type": "text/plain" }, chunks: ["body"] }],
      async () => {
        validationLookups += 1;
        // A second, attacker-controlled lookup at connect time would return 127.0.0.1,
        // but the request must never ask it: it must use the pinned answer above.
        return [{ address: "93.184.216.34", family: 4 }];
      },
    );

    const result = await safeFetchBuffer("https://example.com/", {}, deps);

    assert.equal(result.buffer.toString(), "body");
    assert.equal(validationLookups, 1);
    assert.equal(deps.lookupCalls.length, 1);
    assert.equal(deps.requestOptions.length, 1);
    assert.equal(deps.requestOptions[0].pinnedAddress, "93.184.216.34");
    assert.equal(deps.requestOptions[0].hostname, "example.com");
    assert.equal(await pinnedFromRequestOptions(deps.requestOptions[0]), "93.184.216.34");
  });

  it("rejects a redirect to a private address before connecting to it", async () => {
    const deps = recordingDeps([
      { status: 302, headers: { location: "http://127.0.0.1/" } },
      { status: 200 },
    ]);

    await rejectsValidation(safeFetchBuffer("http://example.com/", {}, deps), /permitted public address/);

    assert.equal(deps.requests.length, 1);
    assert.equal(deps.lookupCalls.length, 1);
    assert.equal(deps.requestOptions[0].pinnedAddress, "93.184.216.34");
  });

  it("rejects a redirect chain exceeding the limit and re-validates each hop", async () => {
    const deps = recordingDeps([
      { status: 302, headers: { location: "http://example.com/next" } },
    ]);

    await rejectsValidation(
      safeFetchBuffer("http://example.com/start", {}, deps),
      /Too many or invalid redirects/,
    );

    assert.equal(deps.requests.length, 4);
    assert.equal(deps.lookupCalls.length, 4);
  });

  it("rejects an oversized streamed response despite a lying content-length", async () => {
    const deps = recordingDeps([
      {
        headers: { "content-length": "1" },
        chunks: ["abcd", "ef"],
      },
    ]);

    await rejectsValidation(
      safeFetchBuffer("http://example.com/", { maxBytes: 4 }, deps),
      /too large/,
    );
  });

  it("rejects an oversized declared content-length before reading the body", async () => {
    const deps = recordingDeps([{ headers: { "content-length": "1000" }, chunks: [] }]);

    await rejectsValidation(
      safeFetchBuffer("http://example.com/", { maxBytes: 10 }, deps),
      /too large/,
    );
  });

  it("maps resolution failures, connection errors, and timeouts to ValidationError", async () => {
    await rejectsValidation(
      assertSafePublicHttpUrl("http://unknown.example/", {
        lookup: async () => {
          throw new Error("ENOTFOUND");
        },
      }),
      /could not be resolved/,
    );

    const errorDeps: FetchDeps = {
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      requestFactory: () => new ErrorRequest(new Error("connect ECONNREFUSED")),
    };
    await rejectsValidation(safeFetchBuffer("http://example.com/", {}, errorDeps), /Remote fetch failed/);

    const timeoutDeps: FetchDeps = {
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      requestFactory: () => new HangingRequest(),
    };
    await rejectsValidation(
      safeFetchBuffer("http://example.com/", { timeoutMs: 10 }, timeoutDeps),
      /Remote fetch timed out/,
    );
  });

  it("keeps the original hostname for Host and TLS SNI while pinning the IP", async () => {
    const deps = recordingDeps([{ headers: { "content-type": "text/plain" }, chunks: ["ok"] }]);

    await safeFetchBuffer("https://example.com/secure", {}, deps);

    const options = deps.requestOptions[0];
    assert.equal(options.protocol, "https:");
    assert.equal(options.hostname, "example.com");
    assert.equal(options.servername, "example.com");
    assert.equal(options.headers.host, "example.com");
    assert.equal(options.pinnedAddress, "93.184.216.34");
  });

  it("includes an explicit non-default URL port in the Host header", async () => {
    const deps = recordingDeps([{ chunks: ["ok"] }]);

    await safeFetchBuffer("https://example.com:80/secure", {}, deps);

    assert.equal(deps.requestOptions[0].headers.host, "example.com:80");
    assert.equal(deps.requestOptions[0].port, "80");
  });

  it("destroys the socket when the connected peer does not match the pinned IP", async () => {
    const socket = new FakeSocket("10.0.0.1");
    const deps = recordingDeps([{ socket }]);

    await rejectsValidation(
      safeFetchBuffer("http://example.com/", {}, deps),
      /peer address mismatch/,
    );

    assert.equal(socket.destroyed, true);
    assert.equal(deps.requestOptions[0].pinnedAddress, "93.184.216.34");
  });

  it("rejects NAT64, 6to4, Teredo and SIIT transition addresses", async () => {
    const transitionAddresses = [
      "64:ff9b::7f00:1",        // NAT64 encoding of 127.0.0.1
      "64:ff9b::c0a8:1",        // NAT64 encoding of 192.168.0.1
      "64:ff9b:1::1",           // NAT64 local-use prefix
      "2002:0a00:1::1",         // 6to4 encoding of 10.0.0.1
      "2002:7f00:1::",          // 6to4 encoding of 127.0.0.1
      "2001::1",                // Teredo / IETF protocol assignments
      "::ffff:0:7f00:1",        // SIIT IPv4-translatable form
    ];
    for (const ip of transitionAddresses) {
      await rejectsValidation(
        assertSafePublicHttpUrl(`http://[${ip}]/`),
        /permitted public address/,
      );
      await rejectsValidation(
        assertSafePublicHttpUrl("http://good.example/", {
          lookup: async () => [{ address: ip, family: 6 }],
        }),
        /permitted public address/,
      );
    }
  });

  it("rejects special-purpose IPv6 ranges while allowing public IPv6", async () => {
    const blocked = [
      "::",
      "::1",
      "fc00::1",
      "fdff::1",
      "fe80::1",
      "fec0::1",
      "ff02::1",
      "100::1",
      "5f00::1",
      "2001:2::1",
      "2001:10::1",
      "2001:20::1",
      "2001:4:112::1",
      "3fff::1",
      "0:1::1",
    ];
    for (const ip of blocked) {
      await rejectsValidation(
        assertSafePublicHttpUrl(`http://[${ip}]/`),
        /permitted public address/,
      );
    }

    const socket = new FakeSocket("2606:4700::1111");
    const deps = recordingDeps([{ chunks: ["v6"], socket }], async () => [
      { address: "2606:4700::1111", family: 6 },
    ]);
    const result = await safeFetchBuffer("https://[2606:4700::1111]/", {}, deps);
    assert.equal(result.buffer.toString(), "v6");
    assert.equal(deps.requestOptions[0].pinnedFamily, 6);
    assert.equal(deps.requestOptions[0].headers.host, "[2606:4700::1111]");
    assert.equal(deps.requestOptions[0].servername, "2606:4700::1111");
    assert.equal(socket.destroyed, false);
  });

  it("rejects remaining special-purpose IPv4 assignments", async () => {
    for (const ip of [
      "192.88.99.1",
      "192.31.196.1",
      "192.52.193.1",
      "192.175.48.1",
      "192.0.0.9",
      "192.0.0.10",
      "240.0.0.1",
      "255.255.255.255",
    ]) {
      await rejectsValidation(
        assertSafePublicHttpUrl(`http://${ip}/`),
        /permitted public address/,
      );
    }
  });

  it("accepts an IPv4-mapped public address based on its embedded IPv4", async () => {
    const socket = new FakeSocket("8.8.8.8");
    const deps = recordingDeps([{ chunks: ["ok"], socket }]);

    const result = await safeFetchBuffer("http://[::ffff:8.8.8.8]/", {}, deps);

    assert.equal(result.buffer.toString(), "ok");
    assert.equal(deps.requestOptions[0].pinnedFamily, 6);
    assert.equal(socket.destroyed, false);
  });

  it("rejects mixed public/private DNS answers and mismatched record families", async () => {
    await rejectsValidation(
      assertSafePublicHttpUrl("http://example.com/", {
        lookup: async () => [
          { address: "93.184.216.34", family: 4 },
          { address: "10.0.0.1", family: 4 },
        ],
      }),
      /permitted public address/,
    );
    await rejectsValidation(
      assertSafePublicHttpUrl("http://example.com/", {
        lookup: async () => [
          { address: "2606:4700::1111", family: 6 },
          { address: "64:ff9b::7f00:1", family: 6 },
        ],
      }),
      /permitted public address/,
    );
    await rejectsValidation(
      assertSafePublicHttpUrl("http://example.com/", {
        lookup: async () => [{ address: "10.0.0.1", family: 6 }],
      }),
      /family does not match/,
    );
  });

  it("uses only the validated DNS answer even if a later lookup would rebind", async () => {
    let calls = 0;
    const deps = recordingDeps([{ chunks: ["ok"] }], async () => {
      calls += 1;
      return calls === 1
        ? [{ address: "93.184.216.34", family: 4 }]
        : [{ address: "10.0.0.1", family: 4 }];
    });

    await safeFetchBuffer("http://example.com/", {}, deps);

    assert.equal(calls, 1);
    assert.equal(await pinnedFromRequestOptions(deps.requestOptions[0]), "93.184.216.34");
  });

  it("rejects redirects to private or transition IPv6 addresses before connecting", async () => {
    for (const ip of ["::1", "fd00::1", "64:ff9b::7f00:1", "2002:7f00:1::"]) {
      const deps = recordingDeps([
        { status: 302, headers: { location: `http://[${ip}]/` } },
        { status: 200 },
      ]);
      await rejectsValidation(
        safeFetchBuffer("http://example.com/", {}, deps),
        /permitted public address/,
      );
      assert.equal(deps.requests.length, 1);
    }
  });

  it("accepts trailing-dot public hosts but rejects zone-scoped addresses", async () => {
    const deps = recordingDeps([{ chunks: ["ok"] }]);
    await safeFetchBuffer("http://example.com./", {}, deps);
    assert.equal(deps.lookupCalls[0].hostname, "example.com.");

    // A zone id changes link scope; never pin a resolver answer that carries one.
    await rejectsValidation(
      assertSafePublicHttpUrl("http://example.com/", {
        lookup: async () => [{ address: "fe80::1%eth0", family: 6 }],
      }),
      /permitted public address/,
    );
  });
});
