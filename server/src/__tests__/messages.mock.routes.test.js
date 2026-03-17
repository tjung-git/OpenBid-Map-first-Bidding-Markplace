import request from "supertest";
import express from "express";

jest.mock("../config.js", () => ({
  config: { prototype: true },
}));

const mockAuthVerify = jest.fn();
jest.mock("../adapters/auth.mock.js", () => ({
  auth: { verify: (...args) => mockAuthVerify(...args) },
}));

const mockConversations = {
  find: jest.fn(),
  create: jest.fn(),
  listByUser: jest.fn(),
  get: jest.fn(),
  update: jest.fn(),
  markRead: jest.fn(),
  hide: jest.fn(),
  unhide: jest.fn(),
  delete: jest.fn(),
};
const mockMessages = {
  list: jest.fn(),
  create: jest.fn(),
};
const mockJobGet = jest.fn();
const mockUserGet = jest.fn();

jest.mock("../adapters/db.mock.js", () => ({
  db: {
    job: { get: (...args) => mockJobGet(...args) },
    user: { get: (...args) => mockUserGet(...args) },
    conversations: mockConversations,
    messages: mockMessages,
  },
}));

jest.mock("../adapters/auth.real.js", () => ({
  auth: { verify: jest.fn() },
}));
jest.mock("../adapters/db.real.js", () => ({ db: {} }));

jest.mock("../lib/firebase.js", () => ({
  getDb: jest.fn(() => {
    throw new Error("getDb should not be called in prototype mode tests");
  }),
}));

const mockIo = {
  to: jest.fn(() => ({ emit: jest.fn() })),
};

let app;
let messagesRoutes;

function makeApp(router) {
  const a = express();
  a.use(express.json());
  a.set("io", mockIo);
  a.use("/api/messages", router);
  a.use((err, req, res, next) => {
    res
      .status(500)
      .json({ error: "server_error", detail: String(err?.message || err) });
  });
  return a;
}

const uid = "user-1";
const otherUid = "user-2";
const jobId = "job-1";
const conversationId = "conv-1";

beforeAll(async () => {
  messagesRoutes = (await import("../routes/messages.routes.js")).default;
  app = makeApp(messagesRoutes);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthVerify.mockResolvedValue({ uid, email: "user1@test.local" });

  mockJobGet.mockResolvedValue({
    id: jobId,
    title: "Test Job",
    posterId: uid,
  });
  mockUserGet.mockResolvedValue({
    uid: otherUid,
    firstName: "Other",
    lastName: "User",
    email: "other@test.local",
  });
});

describe("messages.routes (prototype / unit)", () => {
  describe("POST /start", () => {
    test("401 when auth.verify returns null", async () => {
      mockAuthVerify.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/messages/start")
        .send({ jobId, otherUserId: otherUid });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "unauthorized" });
      expect(mockConversations.find).not.toHaveBeenCalled();
    });

    test("400 when jobId or otherUserId missing", async () => {
      const res1 = await request(app)
        .post("/api/messages/start")
        .set("x-mock-uid", uid)
        .send({ otherUserId: otherUid });
      expect(res1.status).toBe(400);
      expect(res1.body).toEqual({ error: "missing_fields" });

      const res2 = await request(app)
        .post("/api/messages/start")
        .set("x-mock-uid", uid)
        .send({ jobId });
      expect(res2.status).toBe(400);
      expect(res2.body).toEqual({ error: "missing_fields" });
    });

    test("404 when job not found", async () => {
      mockJobGet.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/messages/start")
        .set("x-mock-uid", uid)
        .send({ jobId, otherUserId: otherUid });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "job_not_found" });
      expect(mockConversations.find).not.toHaveBeenCalled();
    });

    test("200 returns existing conversation when find returns one", async () => {
      const existing = {
        id: conversationId,
        jobId,
        participants: [uid, otherUid],
        lastMessageAt: new Date().toISOString(),
      };
      mockConversations.find.mockResolvedValue(existing);

      const res = await request(app)
        .post("/api/messages/start")
        .set("x-mock-uid", uid)
        .send({ jobId, otherUserId: otherUid });

      expect(res.status).toBe(200);
      expect(res.body.conversation).toEqual(existing);
      expect(mockConversations.create).not.toHaveBeenCalled();
    });

    test("200 creates new conversation when find returns null", async () => {
      mockConversations.find.mockResolvedValue(null);
      const created = {
        id: conversationId,
        jobId,
        participants: [uid, otherUid],
        lastMessageAt: expect.any(String),
        updatedAt: expect.any(String),
      };
      mockConversations.create.mockResolvedValue(created);

      const res = await request(app)
        .post("/api/messages/start")
        .set("x-mock-uid", uid)
        .send({ jobId, otherUserId: otherUid });

      expect(res.status).toBe(200);
      expect(res.body.conversation).toMatchObject({
        jobId,
        participants: [uid, otherUid],
      });
      expect(mockConversations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId,
          participants: [uid, otherUid],
        }),
      );
    });
  });

  describe("GET /list", () => {
    test("401 when not authenticated", async () => {
      mockAuthVerify.mockResolvedValue(null);

      const res = await request(app).get("/api/messages/list");
      expect(res.status).toBe(401);
      expect(mockConversations.listByUser).not.toHaveBeenCalled();
    });

    test("200 returns enriched conversations", async () => {
      const convs = [
        {
          id: conversationId,
          jobId,
          participants: [uid, otherUid],
          lastMessageAt: new Date().toISOString(),
        },
      ];
      mockConversations.listByUser.mockResolvedValue(convs);

      const res = await request(app)
        .get("/api/messages/list")
        .set("x-mock-uid", uid);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(1);
      expect(res.body.conversations[0]).toMatchObject({
        id: conversationId,
        jobId,
        jobTitle: "Test Job",
      });
      expect(mockConversations.listByUser).toHaveBeenCalledWith(uid);
    });
  });

  describe("GET /:conversationId", () => {
    test("401 when not authenticated", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const res = await request(app).get(`/api/messages/${conversationId}`);
      expect(res.status).toBe(401);
    });

    test("404 when conversation not found", async () => {
      mockConversations.get.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/messages/${conversationId}`)
        .set("x-mock-uid", uid);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "not_found" });
    });

    test("403 when user is not participant", async () => {
      mockConversations.get.mockResolvedValue({
        id: conversationId,
        participants: ["other-a", "other-b"],
      });

      const res = await request(app)
        .get(`/api/messages/${conversationId}`)
        .set("x-mock-uid", uid);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: "forbidden" });
      expect(mockMessages.list).not.toHaveBeenCalled();
    });

    test("200 returns conversation and messages for participant", async () => {
      const conv = {
        id: conversationId,
        jobId,
        participants: [uid, otherUid],
      };
      const msgList = [
        {
          id: "msg-1",
          conversationId,
          senderId: uid,
          content: "Hello",
          createdAt: new Date().toISOString(),
        },
      ];
      mockConversations.get.mockResolvedValue(conv);
      mockMessages.list.mockResolvedValue(msgList);

      const res = await request(app)
        .get(`/api/messages/${conversationId}`)
        .set("x-mock-uid", uid);

      expect(res.status).toBe(200);
      expect(res.body.conversation).toEqual(conv);
      expect(res.body.messages).toHaveLength(1);
      expect(res.body.messages[0].content).toBe("Hello");
      expect(mockMessages.list).toHaveBeenCalledWith(conversationId);
    });
  });

  describe("POST /:conversationId (send message)", () => {
    test("401 when not authenticated", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const res = await request(app)
        .post(`/api/messages/${conversationId}`)
        .send({ content: "Hi" });
      expect(res.status).toBe(401);
    });

    test("400 when content empty or whitespace", async () => {
      mockConversations.get.mockResolvedValue({
        id: conversationId,
        participants: [uid, otherUid],
      });

      const res1 = await request(app)
        .post(`/api/messages/${conversationId}`)
        .set("x-mock-uid", uid)
        .send({ content: "" });
      expect(res1.status).toBe(400);
      expect(res1.body).toEqual({ error: "empty_message" });

      const res2 = await request(app)
        .post(`/api/messages/${conversationId}`)
        .set("x-mock-uid", uid)
        .send({ content: "   " });
      expect(res2.status).toBe(400);
      expect(res2.body).toEqual({ error: "empty_message" });
    });

    test("404 when conversation not found", async () => {
      mockConversations.get.mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/messages/${conversationId}`)
        .set("x-mock-uid", uid)
        .send({ content: "Hi" });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "not_found" });
    });

    test("403 when user is not participant", async () => {
      mockConversations.get.mockResolvedValue({
        id: conversationId,
        participants: ["other-a", "other-b"],
      });

      const res = await request(app)
        .post(`/api/messages/${conversationId}`)
        .set("x-mock-uid", uid)
        .send({ content: "Hi" });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: "forbidden" });
      expect(mockMessages.create).not.toHaveBeenCalled();
    });

    test("200 creates message and returns it", async () => {
      const conv = {
        id: conversationId,
        participants: [uid, otherUid],
      };
      const createdMsg = {
        id: "msg-1",
        conversationId,
        senderId: uid,
        content: "Hello there",
        createdAt: new Date().toISOString(),
      };
      mockConversations.get.mockResolvedValue(conv);
      mockMessages.create.mockResolvedValue(createdMsg);
      mockConversations.update.mockResolvedValue(conv);

      const res = await request(app)
        .post(`/api/messages/${conversationId}`)
        .set("x-mock-uid", uid)
        .send({ content: "Hello there" });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatchObject({
        content: "Hello there",
        senderId: uid,
      });
      expect(mockMessages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId,
          senderId: uid,
          content: "Hello there",
        }),
      );
      expect(mockConversations.update).toHaveBeenCalledWith(
        conversationId,
        expect.objectContaining({
          lastMessagePreview: "Hello there",
        }),
      );
    });
  });

  describe("POST /:conversationId/read", () => {
    test("401 when not authenticated", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const res = await request(app).post(
        `/api/messages/${conversationId}/read`,
      );
      expect(res.status).toBe(401);
    });

    test("404 when conversation not found", async () => {
      mockConversations.get.mockResolvedValue(null);
      const res = await request(app)
        .post(`/api/messages/${conversationId}/read`)
        .set("x-mock-uid", uid);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "not_found" });
    });

    test("403 when not participant", async () => {
      mockConversations.get.mockResolvedValue({
        id: conversationId,
        participants: ["a", "b"],
      });
      const res = await request(app)
        .post(`/api/messages/${conversationId}/read`)
        .set("x-mock-uid", uid);
      expect(res.status).toBe(403);
      expect(mockConversations.markRead).not.toHaveBeenCalled();
    });

    test("200 marks as read", async () => {
      const updated = {
        id: conversationId,
        participants: [uid, otherUid],
        readBy: { [uid]: new Date().toISOString() },
      };
      mockConversations.get.mockResolvedValue({
        id: conversationId,
        participants: [uid, otherUid],
      });
      mockConversations.markRead.mockResolvedValue(updated);

      const res = await request(app)
        .post(`/api/messages/${conversationId}/read`)
        .set("x-mock-uid", uid);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.conversation).toEqual(updated);
      expect(mockConversations.markRead).toHaveBeenCalledWith(
        conversationId,
        uid,
      );
    });
  });

  describe("POST /:conversationId/hide", () => {
    test("401 when not authenticated", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const res = await request(app).post(
        `/api/messages/${conversationId}/hide`,
      );
      expect(res.status).toBe(401);
    });

    test("404 when conversation not found", async () => {
      mockConversations.get.mockResolvedValue(null);
      const res = await request(app)
        .post(`/api/messages/${conversationId}/hide`)
        .set("x-mock-uid", uid);
      expect(res.status).toBe(404);
    });

    test("200 hides for user", async () => {
      mockConversations.get.mockResolvedValue({
        id: conversationId,
        participants: [uid, otherUid],
      });
      mockConversations.hide.mockResolvedValue(undefined);

      const res = await request(app)
        .post(`/api/messages/${conversationId}/hide`)
        .set("x-mock-uid", uid);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockConversations.hide).toHaveBeenCalledWith(
        conversationId,
        uid,
      );
    });
  });

  describe("POST /:conversationId/unhide", () => {
    test("403 when not participant", async () => {
      mockConversations.get.mockResolvedValue({
        id: conversationId,
        participants: ["a", "b"],
      });
      const res = await request(app)
        .post(`/api/messages/${conversationId}/unhide`)
        .set("x-mock-uid", uid);
      expect(res.status).toBe(403);
    });

    test("200 unhides for user", async () => {
      mockConversations.get.mockResolvedValue({
        id: conversationId,
        participants: [uid, otherUid],
      });
      mockConversations.unhide.mockResolvedValue(undefined);

      const res = await request(app)
        .post(`/api/messages/${conversationId}/unhide`)
        .set("x-mock-uid", uid);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockConversations.unhide).toHaveBeenCalledWith(
        conversationId,
        uid,
      );
    });
  });

  describe("DELETE /:conversationId", () => {
    test("401 when not authenticated", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const res = await request(app).delete(
        `/api/messages/${conversationId}`,
      );
      expect(res.status).toBe(401);
    });

    test("404 when conversation not found", async () => {
      mockConversations.get.mockResolvedValue(null);
      const res = await request(app)
        .delete(`/api/messages/${conversationId}`)
        .set("x-mock-uid", uid);
      expect(res.status).toBe(404);
    });

    test("403 when not participant", async () => {
      mockConversations.get.mockResolvedValue({
        id: conversationId,
        participants: ["a", "b"],
      });
      const res = await request(app)
        .delete(`/api/messages/${conversationId}`)
        .set("x-mock-uid", uid);
      expect(res.status).toBe(403);
      expect(mockConversations.delete).not.toHaveBeenCalled();
    });

    test("200 deletes conversation", async () => {
      mockConversations.get.mockResolvedValue({
        id: conversationId,
        participants: [uid, otherUid],
      });
      mockConversations.delete.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/messages/${conversationId}`)
        .set("x-mock-uid", uid);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockConversations.delete).toHaveBeenCalledWith(conversationId);
    });
  });
});
