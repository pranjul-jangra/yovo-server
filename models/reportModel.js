import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["post", "user"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },  // post || user
    reason: { type: String, required: true },
    details: { type: String },
    actionTaken: {
        action: String,
        durationDays: Number,
        suspended_until: Date
    },
    status: { 
        type: String, 
        enum: ["pending", "reviewed", "resolved", "auto_resolved"], 
        default: "pending" 
    },
    expired: { type: Boolean, default: false }  // soft delete older reports
}, {
    timestamps: true
});

reportSchema.index({ targetId: 1, type: 1 });

const reportModel = mongoose.model("Report", reportSchema);
export default reportModel;