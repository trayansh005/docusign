import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
	{
		firstName: {
			type: String,
			required: [true, "First name is required"],
			trim: true,
			minlength: [2, "First name must be at least 2 characters"],
			maxlength: [50, "First name must not exceed 50 characters"],
		},
		lastName: {
			type: String,
			required: [true, "Last name is required"],
			trim: true,
			minlength: [2, "Last name must be at least 2 characters"],
			maxlength: [50, "Last name must not exceed 50 characters"],
		},
		email: {
			type: String,
			required: [true, "Email is required"],
			unique: true,
			trim: true,
			lowercase: true,
			match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please provide a valid email"],
		},
		password: {
			type: String,
			required: [true, "Password is required"],
			minlength: [8, "Password must be at least 8 characters"],
		},
		phoneNumber: {
			type: String,
			trim: true,
			sparse: true,
		},
		company: {
			type: String,
			trim: true,
			maxlength: [100, "Company name must not exceed 100 characters"],
		},
		role: {
			type: String,
			enum: ["user", "admin"],
			default: "user",
		},
		subscriptions: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "Subscription",
			},
		],
		lastLogin: {
			type: Date,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		emailVerified: {
			type: Boolean,
			default: false,
		},
		emailVerificationToken: {
			type: String,
			sparse: true,
		},
		passwordResetToken: {
			type: String,
			sparse: true,
		},
		passwordResetExpires: {
			type: Date,
		},
		loginAttempts: {
			type: Number,
			default: 0,
		},
		lockUntil: {
			type: Date,
		},
		refreshTokens: [
			{
				token: {
					type: String,
					required: true,
				},
				expires: {
					type: Date,
					required: true,
				},
				createdAt: {
					type: Date,
					default: Date.now,
				},
			},
		],
	},
	{
		timestamps: true,
		toJSON: {
			virtuals: true,
			transform: function (doc, ret) {
				delete ret.password;
				delete ret.emailVerificationToken;
				delete ret.passwordResetToken;
				delete ret.loginAttempts;
				delete ret.lockUntil;
				return ret;
			},
		},
		toObject: { virtuals: true },
	}
);

// Virtual for full name
userSchema.virtual("fullName").get(function () {
	return `${this.firstName} ${this.lastName}`;
});

// Index for performance
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

// Virtual for account lock status
userSchema.virtual("isLocked").get(function () {
	return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Constants for account locking
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

// Pre-save middleware for password hashing
userSchema.pre("save", async function (next) {
	// Only hash password if it has been modified (or is new)
	if (!this.isModified("password")) return next();

	try {
		// Hash password with salt rounds of 12
		const salt = await bcrypt.genSalt(12);
		this.password = await bcrypt.hash(this.password, salt);
		next();
	} catch (error) {
		next(error);
	}
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
	try {
		// If account is locked, return false
		if (this.isLocked) {
			return false;
		}

		const isMatch = await bcrypt.compare(candidatePassword, this.password);

		// If password matches, reset login attempts
		if (isMatch) {
			// Only update if there were previous failed attempts
			if (this.loginAttempts && this.loginAttempts > 0) {
				await this.updateOne({
					$unset: { loginAttempts: 1, lockUntil: 1 },
				});
			}
			return true;
		}

		// Password didn't match, increment attempts
		await this.incLoginAttempts();
		return false;
	} catch (error) {
		throw new Error("Password comparison failed");
	}
};

// Method to increment login attempts and lock account if necessary
userSchema.methods.incLoginAttempts = function () {
	// If we have a previous lock that has expired, restart at 1
	if (this.lockUntil && this.lockUntil < Date.now()) {
		return this.updateOne({
			$set: {
				loginAttempts: 1,
			},
			$unset: {
				lockUntil: 1,
			},
		});
	}

	const updates = { $inc: { loginAttempts: 1 } };

	// If we've reached max attempts and aren't already locked, lock the account
	if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked) {
		updates.$set = { lockUntil: Date.now() + LOCK_TIME };
	}

	return this.updateOne(updates);
};

// Instance method to get user data without sensitive fields
userSchema.methods.toAuthJSON = function () {
	return {
		id: this._id,
		firstName: this.firstName,
		lastName: this.lastName,
		fullName: this.fullName,
		email: this.email,
		phoneNumber: this.phoneNumber,
		company: this.company,
		role: this.role,
		lastLogin: this.lastLogin,
		emailVerified: this.emailVerified,
		isActive: this.isActive,
		createdAt: this.createdAt,
		updatedAt: this.updatedAt,
	};
};

// Method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function () {
	const token =
		Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
	this.emailVerificationToken = token;
	return token;
};

// Method to generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
	const token =
		Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
	this.passwordResetToken = token;
	this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
	return token;
};

// Static method to find by email
userSchema.statics.findByEmail = function (email) {
	return this.findOne({ email: email.toLowerCase() });
};

export default mongoose.model("User", userSchema);
