import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
  isReadBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // track read receipts
}, { timestamps: true });

const messageModel = mongoose.model("Message", messageSchema);
export default messageModel;
