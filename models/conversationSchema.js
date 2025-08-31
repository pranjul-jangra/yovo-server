import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
  isGroup: { type: Boolean, default: false },
  group_name: { type: String },
  group_avatar: { type: String, default: "/group-avatar.png" },
  group_bio: { type: String },

  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  lastMessage: String,
  unreadCount: {
    type: Map, // { userId: count }
    of: Number,
    default: {}
  },

  hiddenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }], // Soft delete chat for specific user
  mutedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
}, { timestamps: true });

conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ hiddenBy: 1 });

const conversationModel = mongoose.model("Conversation", conversationSchema);
export default conversationModel;
