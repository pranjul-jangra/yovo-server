import mongoose from "mongoose";

const saveSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  createdAt: { type: Date, default: Date.now }
});


const saveModel = mongoose.model('Save', saveSchema)
export default saveModel;