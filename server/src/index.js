import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "http";
import { Server } from "socket.io";
import { config } from "./config.js";
import authRoutes from "./routes/auth.routes.js";
import kycRoutes from "./routes/kyc.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import bidsRoutes from "./routes/bids.routes.js";
import passwordRoutes from "./routes/password.routes.js";
import duoRoutes from "./routes/duo.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import messagesRoutes from "./routes/messages.routes.js";
import { db as mockDb } from "./adapters/db.mock.js";
import { db as realDb } from "./adapters/db.real.js";

const app = express();
const httpServer = createServer(app);
const db = config.prototype ? mockDb : realDb;

// Socket.io setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true
  }
});

// Make io available to routes
app.set("io", io);

// Track connected users by socket
const userSockets = new Map(); // userId -> Set of socket ids

io.on("connection", (socket) => {
  console.log("[socket] connected:", socket.id);

  // User joins their room when they authenticate
  socket.on("join", (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId).add(socket.id);
      console.log("[socket] user joined:", userId);
    }
  });

  socket.on("disconnect", () => {
    // Clean up user sockets
    for (const [userId, sockets] of userSockets.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
        break;
      }
    }
    console.log("[socket] disconnected:", socket.id);
  });
});

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_, res) =>
  res.json({ ok: true, prototype: config.prototype })
);

app.use("/api/auth", authRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/bids", bidsRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/auth/duo", duoRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/messages", messagesRoutes);

// Webhook handler for Stripe Identity (only when not in prototype)
if (!config.prototype) {
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      let event;

      try {
        const stripe = (await import("stripe")).default;
        const stripeClient = new stripe(config.stripe.secretKey);
        event = stripeClient.webhooks.constructEvent(
          req.body,
          sig,
          config.stripe.webhookSecret
        );
      } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle the event
      if (event.type === "identity.verification_session.verified") {
        const verificationSession = event.data.object;
        const userId = verificationSession.metadata?.user_id;
        if (userId) {
          // Update user status in database
          const { db } = await import("./adapters/db.real.js");
          const user = await db.user.get(userId);
          if (user) {
            await db.user.upsert({
              ...user,
              kycStatus: "verified",
            });
          }
        }
      }

      res.json({ received: true });
    }
  );
}

app.use((err, req, res, next) => {
  console.error("[server] error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

httpServer.listen(config.port, () => {
  console.log(
    `[server] listening on :${config.port} PROTOTYPE=${config.prototype}`
  );
});

// Export io for use in routes
export { io };
