import request from "supertest";
import { createRealApp, preserveRealEnv, seedRealUser } from "./testUtils.js";

preserveRealEnv();

describe("avatar upload routes (real adapters)", () => {
  let app;
  let db;
  let firestore;

  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMBAJkG8qkAAAAASUVORK5CYII=",
    "base64"
  );

  beforeAll(async () => {
    ({ app, db, firestore } = await createRealApp({ upload: true }));
  });

  beforeEach(() => {
    if (firestore?._collections?.clear) {
      firestore._collections.clear();
    }
    if (typeof firestore?._counter === "number") {
      firestore._counter = 0;
    }
  });

  // Uploading an avatar stores a Firebase Storage download URL and updates profiles/{uid}.
  test("POST /api/upload/avatar stores storage URL in profile", async () => {
    const user = await seedRealUser(db, {
      userType: "contractor",
      uid: "avatar-user",
      email: "avatar-user@example.com",
    });

    const response = await request(app)
      .post("/api/upload/avatar")
      .set("x-mock-uid", user.uid)
      .attach("avatar", tinyPng, { filename: "avatar.png", contentType: "image/png" });

    expect(response.status).toBe(200);
    expect(typeof response.body.avatarUrl).toBe("string");
    expect(response.body.avatarUrl.startsWith("https://firebasestorage.googleapis.com/")).toBe(
      true
    );

    const profile = await db.profile.get(user.uid);
    expect(profile?.avatarUrl).toBe(response.body.avatarUrl);
  });

  // Deleting an avatar clears profiles/{uid}.avatarUrl and returns 204.
  test("DELETE /api/upload/avatar clears profile avatar", async () => {
    const user = await seedRealUser(db, {
      userType: "contractor",
      uid: "avatar-delete-user",
      email: "avatar-delete-user@example.com",
    });

    const uploaded = await request(app)
      .post("/api/upload/avatar")
      .set("x-mock-uid", user.uid)
      .attach("avatar", tinyPng, { filename: "avatar.png", contentType: "image/png" });
    expect(uploaded.status).toBe(200);

    const del = await request(app)
      .delete("/api/upload/avatar")
      .set("x-mock-uid", user.uid);
    expect(del.status).toBe(204);

    const profile = await db.profile.get(user.uid);
    expect(profile?.avatarUrl ?? null).toBe(null);
  });
});

