import request from "supertest";
import {
    createRealApp,
    preserveRealEnv,
    seedRealUser,
    publishJob,
} from "./testUtils.js";

preserveRealEnv();

describe("messages routes (real adapters)", () => {
    let app, db;
    let contractor, bidder;
    let job;

    beforeEach(async () => {
        const setup = await createRealApp({ jobs: true, messages: true, bids: true });
        app = setup.app;
        db = setup.db;

        contractor = await seedRealUser(db, { userType: "contractor", uid: "contractor-1" });
        bidder = await seedRealUser(db, { userType: "bidder", uid: "bidder-1" });
        job = await publishJob(app, contractor.uid);
    });

    test("POST /api/messages/start creates a new conversation", async () => {
        const response = await request(app)
            .post("/api/messages/start")
            .set("x-mock-uid", bidder.uid)
            .send({
                jobId: job.id,
                otherUserId: contractor.uid
            });

        expect(response.status).toBe(200);
        expect(response.body.conversation).toMatchObject({
            jobId: job.id,
            participants: expect.arrayContaining([bidder.uid, contractor.uid])
        });
    });

    test("GET /api/messages/:id retrieves conversation and forbids non-participants", async () => {
        // Start conversation
        const startRes = await request(app)
            .post("/api/messages/start")
            .set("x-mock-uid", bidder.uid)
            .send({ jobId: job.id, otherUserId: contractor.uid });
        const convId = startRes.body.conversation.id;

        // Contractor can retrieval
        const response = await request(app)
            .get(`/api/messages/${convId}`)
            .set("x-mock-uid", contractor.uid);

        expect(response.status).toBe(200);
        expect(response.body.conversation.id).toBe(convId);

        // Random user cannot retrieve
        const intruder = await seedRealUser(db, { uid: "intruder" });
        const intruderRes = await request(app)
            .get(`/api/messages/${convId}`)
            .set("x-mock-uid", intruder.uid);

        expect(intruderRes.status).toBe(403);
    });

    test("POST /api/messages/:id sends a message", async () => {
        const startRes = await request(app)
            .post("/api/messages/start")
            .set("x-mock-uid", bidder.uid)
            .send({ jobId: job.id, otherUserId: contractor.uid });
        const convId = startRes.body.conversation.id;

        const msgRes = await request(app)
            .post(`/api/messages/${convId}`)
            .set("x-mock-uid", bidder.uid)
            .send({ content: "Hello there" });

        expect(msgRes.status).toBe(200);
        expect(msgRes.body.message.content).toBe("Hello there");
        expect(msgRes.body.message.senderId).toBe(bidder.uid);

        // Verify conversation updated
        const convRes = await request(app)
            .get(`/api/messages/${convId}`)
            .set("x-mock-uid", contractor.uid);

        expect(convRes.body.conversation.lastMessagePreview).toBe("Hello there");
        expect(convRes.body.messages).toHaveLength(1);
    });

    test("POST /api/messages/:id/read marks conversation as read", async () => {
        const startRes = await request(app)
            .post("/api/messages/start")
            .set("x-mock-uid", bidder.uid)
            .send({ jobId: job.id, otherUserId: contractor.uid });
        const convId = startRes.body.conversation.id;

        // Contractor reads
        const readRes = await request(app)
            .post(`/api/messages/${convId}/read`)
            .set("x-mock-uid", contractor.uid);

        expect(readRes.status).toBe(200);
        expect(readRes.body.success).toBe(true);
        expect(readRes.body.conversation.readBy).toHaveProperty(contractor.uid);
    });

    test("POST /api/messages/:id/hide hides the conversation for one user", async () => {
        const startRes = await request(app)
            .post("/api/messages/start")
            .set("x-mock-uid", bidder.uid)
            .send({ jobId: job.id, otherUserId: contractor.uid });
        const convId = startRes.body.conversation.id;

        await request(app)
            .post(`/api/messages/${convId}/hide`)
            .set("x-mock-uid", bidder.uid);

        const listRes = await request(app)
            .get("/api/messages/list")
            .set("x-mock-uid", bidder.uid);

        const myConv = listRes.body.conversations.find(c => c.id === convId);
        expect(myConv.hiddenBy).toContain(bidder.uid);
    });
});
