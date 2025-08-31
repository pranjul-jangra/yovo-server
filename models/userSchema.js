import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, trim: true, select: false },

    profile_name: { type: String, trim: true },
    profile_website: {
        website: { type: String, trim: true },
        display_on_profile: { type: Boolean, default: false }
    },
    avatar: { type: String, default: '/user.png' },
    bio: { type: String, trim: true },
    DOB: {
        date: { type: String, trim: true },
        display_on_profile: { type: Boolean, default: false }
    },
    marital_status: {
        status: { type: String, enum: ['Single', 'Married', 'In Relation', 'Divorced', 'Widowed', 'Separated', ""] },
        display_on_profile: { type: Boolean, default: false }
    },
    gender: {
        g: { type: String, enum: ['Male', 'Female', 'Non-binary', 'Transgender', 'Prefer not to say', 'Other', ""] },
        display_on_profile: { type: Boolean, default: false }
    },
    social_links: [{ platform: String, link: String }],

    follower: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    isVerified: { type: Boolean, default: false },   // Email verified status
    phone: String,

    is_account_private: { type: Boolean, default: false },
    is_account_disabled: { type: Boolean, default: false },
    blocked_accounts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    suspended: { type: Boolean, default: false },
    suspended_until: { type: Date, default: null },

    // Session management
    sessions: [
        {
            refreshToken: { type: String, required: true },
            device: {
                vendor: String,
                model: String,
                os: String,
                browser: String,
            },
            location: {
                city: String,
                region: String,
                country: String,
                ip: String,
            },
            createdAt: { type: Date, default: Date.now },
        }
    ],
},
    { timestamps: true }
)


const userModel = mongoose.model("User", userSchema);
export default userModel;