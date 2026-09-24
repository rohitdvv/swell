import { describe, it, expect, vi, beforeEach } from "vitest";

// Identity is Clerk in production; tests decide who is signed in.
const session = vi.hoisted(() => ({ email: null as string | null }));
vi.mock("@/lib/billing/account", () => ({ getAccountEmail: async () => session.email }));

import { isBlockedAddress, assertSafeUrl, safeFetch, guardedLookup, UnsafeUrlError } from "@/lib/safe-fetch";
import { canView, canEdit, requireOwner, requireViewer, toPublic, DEMO_SLUG } from "@/lib/authz";
import { clientIp } from "@/lib/rate-limit";

// ---- SSRF ---------------------------------------------------------

describe("SSRF — addresses a server-side fetch must never reach", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1", // CGNAT
    "0.0.0.0",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:169.254.169.254", // IPv4-mapped metadata
    "::ffff:127.0.0.1",
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "151.101.1.69", "2606:4700:4700::1111", "172.32.0.1"])(
    "allows public %s",
    (ip) => {
      expect(isBlockedAddress(ip)).toBe(false);
    }
  );

  it.each([
    "file:///etc/passwd",
    "gopher://example.com",
    "javascript:alert(1)",
    "ftp://example.com/x",
    "http://user:pass@example.com",
    "http://127.0.0.1:3000/api",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost/",
    "http://db.internal/",
    "http://printer.local/",
    "not a url",
  ])("rejects %s before any network I/O", (u) => {
    expect(() => assertSafeUrl(u)).toThrow(UnsafeUrlError);
  });

  it("accepts ordinary restaurant websites", () => {
    expect(assertSafeUrl("https://osterialume.com/menu").hostname).toBe("osterialume.com");
    expect(assertSafeUrl("http://example.com").protocol).toBe("http:");
  });

  // The connect-time lookup is what defeats DNS rebinding: whatever a name
  // resolves to *at the moment of connecting* is judged. IP literals resolve
  // without the network, so this is deterministic in CI.
  const lookup = (host: string, all = false) =>
    new Promise<{ err: Error | null; addr: unknown }>((resolve) =>
      guardedLookup(host, { all }, (err, addr) => resolve({ err, addr }))
    );

  it.each(["127.0.0.1", "169.254.169.254", "10.0.0.5", "::1"])(
    "connect-time lookup refuses %s",
    async (ip) => {
      const { err } = await lookup(ip);
      expect(err).toBeInstanceOf(UnsafeUrlError);
    }
  );

  it("connect-time lookup lets public addresses through, in both callback shapes", async () => {
    expect(await lookup("8.8.8.8")).toEqual({ err: null, addr: "8.8.8.8" });
    const many = await lookup("1.1.1.1", true);
    expect(many.err).toBeNull();
    expect(many.addr).toEqual([{ address: "1.1.1.1", family: 4 }]);
  });

  it("a fetch whose name resolves to loopback never opens a socket", async () => {
    // The hostname passes the syntactic check; only the guarded lookup stops it.
    const err = await safeFetch("http://localhost./", { timeoutMs: 3000 }).catch((e) => e);
    // Where the OS resolver can't resolve `localhost.` at all, it's still refused.
    expect(err).toBeInstanceOf(Error);
    if (err.cause && !/ENOTFOUND|EAI_AGAIN/.test(String(err.cause.code))) {
      expect(err.cause).toBeInstanceOf(UnsafeUrlError);
    }
  });
});

// ---- Tenant isolation --------------------------------------------

describe("authorization matrix", () => {
  const draft = { slug: "osteria-oct", status: "draft", owner_email: "owner@a.com" } as const;
  const published = { ...draft, status: "published" } as const;
  const demo = { slug: DEMO_SLUG, status: "draft", owner_email: null } as const;

  it.each([
    // campaign, viewer, canView, canEdit
    [draft, null, false, false],
    [draft, "rival@b.com", false, false],
    [draft, "owner@a.com", true, true],
    [published, null, true, false],
    [published, "rival@b.com", true, false],
    [published, "owner@a.com", true, true],
    [demo, null, true, false],
    [demo, "anyone@c.com", true, false],
  ] as const)("%o viewed by %s → view %s, edit %s", (c, viewer, v, e) => {
    expect(canView(c as never, viewer)).toBe(v);
    expect(canEdit(c as never, viewer)).toBe(e);
  });

  it("a legacy row with no owner is editable by nobody", () => {
    const orphan = { slug: "x", status: "published", owner_email: null } as never;
    expect(canEdit(orphan, "owner@a.com")).toBe(false);
  });

  it("owner emails never leave the server", () => {
    const c = { ...draft, name: "Osteria" };
    const pub = toPublic(c);
    expect(pub.owner_email).toBeNull();
    expect(pub.name).toBe("Osteria");
    expect(c.owner_email).toBe("owner@a.com"); // original untouched
  });

  describe("route guards", () => {
    beforeEach(() => {
      session.email = null;
    });

    it("requireOwner: 401 signed out, 404 for someone else's draft, 403 for published-not-yours, pass for owner", async () => {
      expect((await requireOwner(draft as never))?.status).toBe(401);
      session.email = "rival@b.com";
      // 404, not 403 — a private draft must not confirm it exists
      expect((await requireOwner(draft as never))?.status).toBe(404);
      expect((await requireOwner(published as never))?.status).toBe(403);
      expect((await requireOwner(null))?.status).toBe(404);
      session.email = "owner@a.com";
      expect(await requireOwner(draft as never)).toBeNull();
    });

    it("the demo is read-only for everyone", async () => {
      session.email = "anyone@c.com";
      expect((await requireOwner(demo as never))?.status).toBe(403);
      expect(await requireViewer(demo as never)).toBeNull();
    });

    it("requireViewer hides drafts from strangers, serves published to all", async () => {
      expect((await requireViewer(draft as never))?.status).toBe(404);
      expect(await requireViewer(published as never)).toBeNull();
      session.email = "owner@a.com";
      expect(await requireViewer(draft as never)).toBeNull();
    });
  });
});

// ---- Rate-limit identity ------------------------------------------

describe("clientIp", () => {
  const req = (h: Record<string, string>) => new Request("https://swell.test", { headers: h });
  it("prefers the platform's x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.2.3.4" }))).toBe("203.0.113.9");
  });
  it("falls back to the first x-forwarded-for hop", () => {
    expect(clientIp(req({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" }))).toBe("198.51.100.7");
  });
  it("never throws without headers", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});
