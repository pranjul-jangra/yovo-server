import mongoose from "mongoose";

const statusSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  mediaUrl: String,
  caption: String,
  viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now, expires: '24h' } // TTL auto-delete
});


const statusModal = mongoose.model("Status", statusSchema);
export default statusModal;