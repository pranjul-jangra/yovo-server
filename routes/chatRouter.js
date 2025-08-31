import express from "express";
import {
    addParticipants,
    createGroupConversation,
    createOrGetConversation,
    deleteGroup,
    deleteMessage,
    demoteFromAdmin,
    getConversations,
    getGroupInfo,
    getMessages,
    getSpecificConvo,
    hideConversation,
    leaveGroup,
    markAsRead,
    muteConversation,
    promoteToAdmin,
    removeParticipants,
    renameGroup,
    searchConversations,
    searchMessages,
    sendMessage,
    unhideConversation,
    unmuteConversation,
    updateGroupAvatar
} from '../controllers/chatController.js';
import upload from "../middlewares/multer.js";

const chatRouter = express.Router();


// One-to-one or group
chatRouter.post("/conversation", createOrGetConversation);

// Messaging
chatRouter.get("/", getConversations);
chatRouter.get("/:conversationId", getMessages);
chatRouter.get("/:conversationId/convo", getSpecificConvo);
chatRouter.post("/send-message", sendMessage);
chatRouter.post("/:conversationId/mark-as-read", markAsRead);

// Hide / unhide
chatRouter.post("/:conversationId/hide", hideConversation);
chatRouter.post("/:conversationId/unhide", unhideConversation);

// Delete own message
chatRouter.delete("/message/:messageId", deleteMessage);

// Group chat
chatRouter.post("/group", createGroupConversation);
chatRouter.post("/:conversationId/add", addParticipants);

// Group management
chatRouter.post("/:conversationId/remove", removeParticipants);
chatRouter.post("/:conversationId/leave", leaveGroup);
chatRouter.post("/:conversationId/promote", promoteToAdmin);
chatRouter.post("/:conversationId/demote", demoteFromAdmin);
chatRouter.put("/:conversationId/rename", renameGroup);

chatRouter.put("/:conversationId/avatar", upload.single('group-avatar'), updateGroupAvatar);
chatRouter.get("/:conversationId/info", getGroupInfo);
chatRouter.post("/:conversationId/mute", muteConversation);
chatRouter.post("/:conversationId/unmute", unmuteConversation);
chatRouter.delete("/:conversationId/delete", deleteGroup);

// Searching
chatRouter.get("/search/conversations", searchConversations);
chatRouter.get("/:conversationId/search-messages", searchMessages);



export default chatRouter;