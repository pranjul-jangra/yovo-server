import conversationModel from "../models/conversationSchema.js";
import messageModel from "../models/messageSchema.js";
import { extractPublicId } from "../utils/extractPublicId.js";
import { cloudinary } from "../middlewares/multer.js";
import { verifyAccessToken } from "../utils/userUtils.js";
import mongoose from "mongoose";


// Create or get the conversation
export const createOrGetConversation = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const myId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

    // Get other participant from body
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const otherId = mongoose.Types.ObjectId.createFromHexString(userId);

    // Check if conversation already exists
    let conversation = await conversationModel
      .findOne({ isGroup: false, participants: { $all: [myId, otherId] } })
      .populate("participants", "username profile_name avatar")
      .populate("lastMessage");

    if (!conversation) {
      // Create new conversation
      conversation = await conversationModel.create({ participants: [myId, otherId], isGroup: false });
      conversation = await conversation.populate("participants", "username profile_name avatar");
    }

    res.status(200).json({ success: true, conversation });
  } catch (error) {
    console.error("createOrGetConversation error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Get messages
export const getMessages = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const myId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
    const { conversationId } = req.params;
    if (!conversationId) return res.status(400).json({ error: "conversationId required" });

    // Verify conversation exists and user is part of it
    const convo = await conversationModel.findById(conversationId).select("participants");
    if (!convo) return res.status(404).json({ error: "Conversation not found" });
    const isParticipant = convo.participants.some(p => String(p) === String(myId));
    if (!isParticipant) return res.status(403).json({ error: "Not a participant" });

    // pagination
    let { limit = 20, before } = req.query;
    limit = Math.min(parseInt(limit, 10) || 20, 100);

    const query = { conversationId: mongoose.Types.ObjectId.createFromHexString(conversationId) };
    if (before) {
      query._id = { $lt: mongoose.Types.ObjectId.createFromHexString(before) };
    }

    // Fetch messages sorted by createdAt
    const messages = await messageModel
      .find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .populate("sender", "username profile_name avatar")
      .lean();

    return res.status(200).json({ success: true, messages: messages.reverse() });

  } catch (error) {
    console.error("getMessages error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Send message
export const sendMessage = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const myId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
    const { conversationId, text } = req.body;
    if (!conversationId) return res.status(400).json({ error: "conversationId is required." });
    if (!text || !String(text).trim()) return res.status(400).json({ error: "text required" });

    // Verify conversation
    const convo = await conversationModel.findById(conversationId);
    if (!convo) return res.status(404).json({ error: "Conversation not found" });
    const isParticipant = convo.participants.some(p => String(p) === String(myId));
    if (!isParticipant) return res.status(403).json({ error: "Not a participant" });

    // create message (mark sender as having read it)
    let message = await messageModel.create({
      conversationId: mongoose.Types.ObjectId.createFromHexString(conversationId),
      sender: myId,
      text: String(text).trim(),
      isReadBy: [myId],
    });

    // Build unread updates for DB update
    const unreadUpdates = {};
    const recipients = [];
    convo.participants.forEach((p) => {
      const idStr = p.toString();
      if (idStr !== myId.toString()) {
        const prev = convo.unreadCount?.get(idStr) || 0;
        unreadUpdates[`unreadCount.${idStr}`] = prev + 1;
        recipients.push(mongoose.Types.ObjectId.createFromHexString(idStr));
      }
    });

    // Update conversation: lastMessage (string), unread counts, and auto-unhide recipients
    await conversationModel.findByIdAndUpdate(
      conversationId,
      {
        lastMessage: String(text).trim(),
        $set: unreadUpdates,
        ...(recipients.length ? { $pull: { hiddenBy: { $in: recipients } } } : {}),
      },
      { new: true }
    );

    // populate sender for response
    message = await message.populate("sender", "username profile_name avatar");

    // emit real-time update
    req.io.to(`conversation:${conversationId}`).emit("newMessage", message);
    return res.status(201).json({ success: true, message });

  } catch (error) {
    console.error("sendMessage error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Mark as read
export const markAsRead = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
    const { conversationId } = req.params;

    // Ensure user is a participant
    const conversation = await conversationModel.findById(conversationId);
    if (!conversation || !conversation.participants.includes(userId)) {
      return res.status(403).json({ error: "Not allowed" });
    }

    // Update unread count for this user
    conversation.unreadCount.set(userId.toString(), 0);
    await conversation.save();

    // Mark all messages as read by this user
    await messageModel.updateMany(
      { conversationId, isReadBy: { $ne: userId } },
      { $addToSet: { isReadBy: userId } }
    );

    res.status(200).json({ success: true, message: "Conversation marked as read" });

  } catch (err) {
    console.error("markAsRead error:", err);
    res.status(500).json({ error: "Failed to mark messages as read" });
  }
};

// Get conversation
export const getConversations = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

    // pagination params
    let { limit = 20, before } = req.query;
    limit = Math.min(parseInt(limit, 10) || 20, 100);

    const query = { participants: userId, hiddenBy: { $ne: userId } };
    if (before) {
      query._id = { $lt: mongoose.Types.ObjectId.createFromHexString(before) };
    }

    // Fetch all conversations where user is a participant and not hidden
    const conversations = await conversationModel.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate("participants", "username profile_name avatar")
      .lean();

    // Attach lastMessage details properly
    const results = await Promise.all(
      conversations.map(async (conv) => {
        const lastMsg = await messageModel.findOne({ conversationId: conv._id })
          .sort({ createdAt: -1 })
          .populate("sender", "username profile_name avatar");

        return {
          ...conv,
          lastMessage: lastMsg ? {
            _id: lastMsg._id,
            text: lastMsg.text,
            sender: lastMsg.sender,
            createdAt: lastMsg.createdAt,
          } : null,
          unreadCount: conv.unreadCount[userId.toString()] || 0
        };
      })
    );

    res.status(200).json({ success: true, conversations: results });

  } catch (err) {
    console.error("getConversations error:", err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
};

// Get specific conversation
export const getSpecificConvo = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const { conversationId } = req.params;

    const conversation = await conversationModel
      .findById(conversationId)
      .populate("participants", "username profile_name avatar")
      .lean();

    if (!conversation) return res.status(403).json({ error: "Not allowed" });
    res.status(200).json({ conversation });

  } catch (error) {
    console.log("Error getting convo:", error);
    res.status(500).json({ error: "Error getting convo due to server error." })
  }
}

// Hide conversation (soft delete chat for individual user)
export const hideConversation = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
    const { conversationId } = req.params;

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (!conversation.participants.some(p => p.toString() === userId.toString())) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Add user to hiddenBy if not already
    if (!conversation.hiddenBy.includes(userId)) {
      conversation.hiddenBy.push(userId);
      await conversation.save();
    }

    res.status(200).json({ success: true, message: "Conversation hidden" });

  } catch (err) {
    console.error("hideConversation error:", err);
    res.status(500).json({ error: "Failed to hide conversation" });
  }
};

// Unhide a conversation
export const unhideConversation = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
    const { conversationId } = req.params;

    await conversationModel.findByIdAndUpdate(
      conversationId,
      { $pull: { hiddenBy: userId } }
    );

    res.status(200).json({ success: true, message: "Conversation unhidden" });

  } catch (err) {
    console.error("unhideConversation error:", err);
    res.status(500).json({ error: "Failed to unhide conversation" });
  }
};

// Delete own message
export const deleteMessage = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
    const { messageId } = req.params;

    const message = await messageModel.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    // Only sender can delete their own message
    if (message.sender.toString() !== userId.toString()) return res.status(403).json({ error: "Not authorized" });

    await messageModel.findByIdAndDelete(messageId);

    res.status(200).json({ success: true, message: "Message deleted" });

  } catch (err) {
    console.error("deleteMessage error:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
};

// ================================== Group conversation ========================================

// Create group conversation
export const createGroupConversation = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

    const { name, participants } = req.body;

    if (!name || !participants || participants.length < 2) return res.status(400).json({ error: "Group must have a name and at least 3 members including you" });

    // Add creator to participants
    const allParticipants = [...new Set([...participants, userId.toString()])];

    const conversation = await conversationModel.create({
      isGroup: true,
      group_name: name,
      participants: allParticipants,
      admins: [userId],
    });

    res.status(201).json(conversation);

  } catch (err) {
    console.error("createGroupConversation error:", err);
    res.status(500).json({ error: "Failed to create group" });
  }
};

// Add participants
export const addParticipants = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

    const { conversationId } = req.params;
    const { participantsToAdd } = req.body;

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    // Only admins can add members
    if (!conversation.admins.some(a => a.toString() === userId.toString())) {
      return res.status(403).json({ error: "Only group admins can add members" });
    }

    // Normalize into array
    const participantsArray = Array.isArray(participantsToAdd) ? participantsToAdd : [participantsToAdd];

    // Add unique participants only
    let addedUsers = [];
    participantsArray.forEach(uid => {
      if (!conversation.participants.some(p => p.toString() === uid.toString())) {
        conversation.participants.push(uid);
        addedUsers.push(uid);
      }
    });

    await conversation.save();
    return res.status(200).json({ message: "Participants added successfully", addedUsers, conversation });

  } catch (error) {
    console.error("addParticipants error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

// Remove participants
export const removeParticipants = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

    const { conversationId } = req.params;
    const { participantsToRemove } = req.body; // single id or array

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    // Only admins can remove
    if (!conversation.admins.some(a => a.toString() === userId.toString())) {
      return res.status(403).json({ error: "Only group admins can remove members" });
    }

    // Normalize into array
    const participantsArray = Array.isArray(participantsToRemove) ? participantsToRemove : [participantsToRemove];

    // Remove participants
    conversation.participants = conversation.participants.filter(
      uid => !participantsArray.includes(uid.toString())
    );

    // Also remove from admin list if removed
    conversation.admins = conversation.admins.filter(
      uid => !participantsArray.includes(uid.toString())
    );

    await conversation.save();
    return res.status(200).json({ message: "Participants removed successfully", removedUsers: participantsArray, conversation });

  } catch (error) {
    console.error("removeParticipants error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Leave group
export const leaveGroup = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
    const { conversationId } = req.params;

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    // Remove user from participants
    conversation.participants = conversation.participants.filter(
      uid => uid.toString() !== userId.toString()
    );

    // If user was an admin, remove from admin list too
    conversation.admins = conversation.admins.filter(
      uid => uid.toString() !== userId.toString()
    );

    await conversation.save();
    return res.status(200).json({ message: "You have left the group", conversation });

  } catch (error) {
    console.error("leaveGroup error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Promote to admin
export const promoteToAdmin = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

    const { conversationId } = req.params;
    const { usersToPromote } = req.body; // single id or array

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    // Only admins can promote
    if (!conversation.admins.some(a => a.toString() === userId.toString())) {
      return res.status(403).json({ error: "Only admins can promote members" });
    }

    const usersArray = Array.isArray(usersToPromote) ? usersToPromote : [usersToPromote];

    usersArray.forEach(uid => {
      if (
        conversation.participants.some(p => p.toString() === uid.toString()) &&
        !conversation.admins.some(a => a.toString() === uid.toString())
      ) {
        conversation.admins.push(uid);
      }
    });

    await conversation.save();
    return res.status(200).json({ message: "Users promoted to admin", conversation });

  } catch (error) {
    console.error("promoteToAdmin error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Demote admin
export const demoteFromAdmin = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

    const { conversationId } = req.params;
    const { usersToDemote } = req.body; // single id or array

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    // Only admins can demote
    if (!conversation.admins.some(a => a.toString() === userId.toString())) {
      return res.status(403).json({ error: "Only admins can demote members" });
    }

    const usersArray = Array.isArray(usersToDemote) ? usersToDemote : [usersToDemote];

    conversation.admins = conversation.admins.filter(
      uid => !usersArray.includes(uid.toString())
    );

    await conversation.save();
    return res.status(200).json({ message: "Users demoted from admin", conversation });

  } catch (error) {
    console.error("demoteFromAdmin error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Rename group (admin-only)
export const renameGroup = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

    const { conversationId } = req.params;
    const { newName } = req.body;

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (!conversation.isGroup) return res.status(400).json({ error: "Not a group conversation" });

    // Only admins can rename
    if (!conversation.admins.some(a => a.toString() === userId.toString())) {
      return res.status(403).json({ error: "Only admins can rename the group" });
    }

    conversation.group_name = newName;
    await conversation.save();
    return res.status(200).json({ message: "Group renamed successfully", conversation });

  } catch (error) {
    console.error("renameGroup error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Update group avatar
export const updateGroupAvatar = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

    const { conversationId } = req.params;
    const avatarUrl = req.file.path;

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (!conversation.isGroup) return res.status(400).json({ error: "Not a group conversation" });

    if (!conversation.admins.some(a => a.toString() === userId.toString())) {
      return res.status(403).json({ error: "Only admins can update group avatar" });
    }

    // Delete old avatar if exists
    if (avatarUrl && conversation.group_avatar.includes("cloudinary")) {
      const publicId = await extractPublicId(conversation.group_avatar);
      if (publicId) await cloudinary.uploader.destroy(publicId);
    }

    conversation.group_avatar = avatarUrl;
    await conversation.save();
    return res.status(200).json({ message: "Group avatar updated successfully", conversation });

  } catch (error) {
    console.error("updateGroupAvatar error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Get group info (participants, admins)
export const getGroupInfo = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await conversationModel.findById(conversationId)
      .populate("participants", "username profile_name avatar")
      .populate("admins", "username profile_name avatar")

    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    return res.status(200).json(conversation);

  } catch (error) {
    console.error("getGroupInfo error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Mute conversation
export const muteConversation = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
    const { conversationId } = req.params;

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    if (!conversation.mutedBy) conversation.mutedBy = [];

    if (!conversation.mutedBy.includes(userId.toString())) {
      conversation.mutedBy.push(userId);
      await conversation.save();
    }

    return res.status(200).json({ message: "Conversation muted" });

  } catch (error) {
    console.error("muteConversation error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Unmute conversation
export const unmuteConversation = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
    const { conversationId } = req.params;

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    conversation.mutedBy = conversation.mutedBy.filter(
      uid => uid.toString() !== userId.toString()
    );
    await conversation.save();
    return res.status(200).json({ message: "Conversation unmuted" });

  } catch (error) {
    console.error("unmuteConversation error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Delete group
export const deleteGroup = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);
    const { conversationId } = req.params;

    const conversation = await conversationModel.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (!conversation.isGroup) return res.status(400).json({ error: "Not a group conversation" });

    if (!conversation.admins.some(a => a.toString() === userId.toString())) {
      return res.status(403).json({ error: "Only admin can delete the group" });
    }

    await messageModel.deleteMany({ conversationId });
    await conversationModel.findByIdAndDelete(conversationId);

    return res.status(200).json({ message: "Group deleted successfully" });

  } catch (error) {
    console.error("deleteGroup error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Search conversation
export const searchConversations = async (req, res) => {
  try {
    const accessToken = req.headers?.authorization?.split(" ")?.[1];
    if (!accessToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await verifyAccessToken(accessToken);
    if (!decoded || !decoded.id) return res.status(401).json({ error: "Invalid token" });

    const userId = mongoose.Types.ObjectId.createFromHexString(decoded.id);

    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Search query is required" });

    const conversations = await conversationModel
      .find({
        participants: userId,
        $or: [
          { group_name: { $regex: q, $options: "i" } },
          {
            // match participant usernames
            participants: {
              $in: await mongoose.model("User").find({
                username: { $regex: q, $options: "i" }
              }).distinct("_id")
            }
          }
        ]
      })
      .populate("participants", "username profile_name avatar")
      .populate("admin", "username profile_name")
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();

    res.status(200).json(conversations);

  } catch (err) {
    console.error("searchConversations error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Search messsage in a conversation
export const searchMessages = async (req, res) => {
  try {
    const { q } = req.query;
    const { conversationId } = req.params;
    if (!q) return res.status(400).json({ error: "Search query is required" });

    const messages = await messageModel.find({
      conversationId,
      text: { $regex: q, $options: "i" }
    })
      .populate("sender", "username profile_name avatar")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.status(200).json(messages);

  } catch (err) {
    console.error("searchMessages error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
