import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const STORAGE_KEY = "openbid_session";
const INACTIVITY_LIMIT = 2 * 60 * 1000;

async function importSessionModule() {
  return import("../services/session.js");
}

describe("session service", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists session data and notifies subscribers", async () => {
    // Saving a session should store data and ping listeners
    const { setSession, getSession, subscribeSession } =
      await importSessionModule();

    const listener = vi.fn();
    const unsubscribe = subscribeSession(listener);

    setSession({ user: { uid: "user-1" }, prototype: true });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getSession()).toMatchObject({
      user: { uid: "user-1" },
      prototype: true,
    });

    const stored = window.localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored).user.uid).toBe("user-1");
    expect(window.localStorage.getItem("mockUid")).toBe("user-1");

    unsubscribe();
  });

  it("updates users while preserving or overriding requirements", async () => {
    // setUser should keep requirements unless we give new ones
    const { setSession, setUser, getSession, getRequirements } =
      await importSessionModule();

    setSession({
      user: { uid: "contractor-1" },
      requirements: { emailVerified: false, kycVerified: false },
      prototype: false,
    });

    setUser(
      { uid: "bidder-99" },
      { emailVerified: true, kycVerified: true }
    );

    expect(getSession().user.uid).toBe("bidder-99");
    expect(getRequirements()).toEqual({
      emailVerified: true,
      kycVerified: true,
    });
  });

  it("triggers inactivity timeout when no activity occurs", async () => {
    // After two minutes with no input the timeout should fire
    vi.useFakeTimers();
    const { setSession, startInactivityMonitor } = await importSessionModule();

    setSession({ user: { uid: "timer-user" } });
    const onTimeout = vi.fn();
    const stop = startInactivityMonitor(onTimeout);

    expect(typeof stop).toBe("function");

    vi.advanceTimersByTime(INACTIVITY_LIMIT - 1);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    stop();
  });
});
