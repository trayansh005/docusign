import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String,
            required: [true, "Session ID is required"],
            unique: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User ID is required"],
            index: true,
        },
        deviceInfo: {
            userAgent: {
                type: String,
                required: [true, "User agent is required"],
            },
            ip: {
                type: String,
                required: [true, "IP address is required"],
            },
            deviceName: {
                type: String,
                required: [true, "Device name is required"],
            },
        },
        createdAt: {
            type: Date,
            default: Date.now,
            immutable: true,
        },
        lastActivity: {
            type: Date,
            default: Date.now,
            required: true,
        },
        expiresAt: {
            type: Date,
            required: [true, "Expiration date is required"],
            index: true,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
    },
    {
        timestamps: false, // Using custom createdAt/lastActivity
    }
);

// TTL index for automatic cleanup of expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance method to check if session has expired
sessionSchema.methods.isExpired = function () {
    return this.expiresAt < Date.now();
};

// Instance method to extend session expiry
sessionSchema.methods.extend = function (days = 7) {
    this.lastActivity = Date.now();
    this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return this.save();
};

// Instance method to return safe session data for client
sessionSchema.methods.toClientJSON = function () {
    return {
        id: this._id,
        deviceInfo: {
            deviceName: this.deviceInfo.deviceName,
            userAgent: this.deviceInfo.userAgent,
            ip: this.deviceInfo.ip,
        },
        createdAt: this.createdAt,
        lastActivity: this.lastActivity,
        expiresAt: this.expiresAt,
        isActive: this.isActive,
    };
};

// Static method to find session by sessionId
sessionSchema.statics.findBySessionId = function (sessionId) {
    return this.findOne({ sessionId, isActive: true });
};

export default mongoose.model("Session", sessionSchema);
