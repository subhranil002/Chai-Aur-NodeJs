import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const verifyAccessToken = asyncHandler(async (req, res, next) => {
    try {
        const token =
            req.cookies?.accessToken ||
            req.headers?.authorization?.split(" ")[1];

        if (!token) {
            return next(new ApiError("Unauthorized request", 401));
        }

        const userInfo = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        const user = User.findById(userInfo._id).select(
            "-password -refreshToken"
        );

        if (!user) {
            return next(new ApiError("Invalid access token", 401));
        }

        req.user = user;
        next();
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
});
