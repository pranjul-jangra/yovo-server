import mongoose from "mongoose";

const tagsSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, lowercase: true, trim: true },
    usageCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const tagsModel = mongoose.model("tags", tagsSchema);
export default tagsModel;
