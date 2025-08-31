import express from 'express';
import http from "http";
import { Server } from "socket.io";
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import connectDB from './config/mongodb.js';
import authRouter from './routes/authRouter.js';
import postRouter from './routes/postRouter.js';
import accountRouter from './routes/accountRouter.js';
import { globalLimiter } from './middlewares/rateLimiting.js';
import profileRouter from './routes/profileRouter.js';
import chatRouter from './routes/chatRouter.js';
import messageModel from './models/messageSchema.js';
import activityRouter from './routes/activityRouter.js';
import reportRouter from './routes/reportRouter.js';
import cronRouter from './routes/cronRouter.js';
import keepAliveRouter from './routes/keepAliveRouter.js';
import postActionsRouter from './routes/postActionsRouter.js';
import exploreRouter from './routes/exploreRouter.js';
import followRouter from './routes/followRouter.js';


const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// socket.io instance ================================================================================
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
});

// track online users { userId -> [socketId] }
const onlineUsers = new Map();

io.on("connection", (socket) => {
  // Register user
  socket.on("registerUser", (userId) => {
    if (!userId) return;
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, []);
    const sockets = onlineUsers.get(userId);
    if (!sockets.includes(socket.id)) sockets.push(socket.id);
    onlineUsers.set(userId, sockets);

    // Send online users list
    io.emit("onlineUsers", Array.from(onlineUsers.keys()));
  });

  socket.on("getOnlineUsers", () => {
    socket.emit("onlineUsers", Array.from(onlineUsers.keys()));
  });

  // --- Conversations (works for 1-1 and group) ---
  socket.on("joinConversation", (conversationId) => {
    if (!conversationId) return;
    socket.join(`conversation:${conversationId}`);
  });

  socket.on("leaveConversation", (conversationId) => {
    if (!conversationId) return;
    socket.leave(`conversation:${conversationId}`);
  });

  // Typing indicator
  socket.on("typing", ({ conversationId, userId }) => {
    socket.to(`conversation:${conversationId}`).emit("typing", { userId });
  });

  // --- Message Deletion ---
  socket.on("deleteMessage", async ({ conversationId, messageId }) => {
    try {
      await messageModel.findByIdAndDelete(messageId);
      io.to(`conversation:${conversationId}`).emit("messageDeleted", messageId);
    } catch (err) {
      console.error("deleteMessage error:", err);
    }
  });

  // --- Group Updates (rename, add/remove members, delete) ---
  socket.on("groupUpdated", ({ conversationId, update }) => {
    io.to(`conversation:${conversationId}`).emit("groupUpdated", update);
  });

  socket.on("groupDeleted", ({ conversationId }) => {
    io.to(`conversation:${conversationId}`).emit("groupDeleted", conversationId);
  });

  // Disconnect cleanup
  socket.on("disconnect", () => {
    for (const [userId, sockets] of onlineUsers.entries()) {
      const updated = sockets.filter((sid) => sid !== socket.id);
      if (updated.length > 0) {
        onlineUsers.set(userId, updated);
      } else {
        onlineUsers.delete(userId);
      }
    }
    io.emit("onlineUsers", Array.from(onlineUsers.keys()));
  });
});

// Middlewares =========================================================================================
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Make the socket accessible in every controller
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(globalLimiter);
connectDB();


// Routes ==============================================================================================
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/posts', postRouter);
app.use('/api/account', accountRouter);
app.use('/api/chat', chatRouter);
app.use('/api/activity', activityRouter);
app.use('/api/report', reportRouter);
app.use('/api/post-action', postActionsRouter);
app.use('/api/explore', exploreRouter);
app.use('/api/follow', followRouter);

// Used to run as corn job
app.use('/api/cron', cronRouter);
app.use("/api/keep-alive", keepAliveRouter);



// Listen to port =======================================================================================
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`))