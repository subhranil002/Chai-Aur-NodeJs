import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import constants from "../constants.js";

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowecase: true,
            trim: true,
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        avatar: {
            type: String,
            required: true,
        },
        coverImage: {
            type: String,
        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video",
            },
        ],
        password: {
            type: String,
            required: true,
        },
        refreshToken: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password.trim(), 10);
    console.log("Password hashed successfully");
    next();
});

userSchema.methods = {
    isPasswordCorrect: async function (password) {
        return await bcrypt.compare(password, this.password);
    },
    generateJWTToken: function () {
        return jwt.sign(
            {
                _id: this._id,
                username: this.username,
                email: this.email,
                fullName: this.fullName,
            },
            constants.JWT_SECRET,
            { expiresIn: constants.JWT_EXPIRE }
        );
    },
    generateRefreshToken: function () {
        return jwt.sign(
            {
                _id: this._id,
            },
            constants.REFRESH_TOKEN_SECRET,
            { expiresIn: constants.REFRESH_TOKEN_EXPIRE }
        );
    },
};

export const User = mongoose.model("User", userSchema);
