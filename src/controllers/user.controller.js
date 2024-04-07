import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {
    handleUpload,
    deleteLocalFiles,
    deleteFileFromCloudinary,
} from "../utils/handleCloudinary.js";
import constants from "../constants.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (user) => {
    try {
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            `Something went wrong while generating tokens ${error}`,
            500
        );
    }
};

export const registerUser = asyncHandler(async (req, res, next) => {
    try {
        const { fullName, username, email, password } = req.body;
        const avatarLocalPath = req.files.avatar
            ? req.files.avatar[0]?.path
            : "";
        const coverImageLocalPath = req.files.coverImage
            ? req.files.coverImage[0]?.path
            : "";

        if (!fullName || !username || !email || !password) {
            deleteLocalFiles([avatarLocalPath, coverImageLocalPath]);
            return next(new ApiError("All fields are required", 400));
        } else if (
            [fullName, username, email, password].some(
                (field) => field?.trim() === ""
            )
        ) {
            deleteLocalFiles([avatarLocalPath, coverImageLocalPath]);
            return next(new ApiError("All fields are required", 400));
        }

        const userExists = await User.findOne({
            $or: [{ username }, { email }],
        });

        if (userExists) {
            deleteLocalFiles([avatarLocalPath, coverImageLocalPath]);
            return next(new ApiError("User already exists", 409));
        }

        if (!avatarLocalPath) {
            deleteLocalFiles([coverImageLocalPath]);
            return next(new ApiError("Avatar is required", 400));
        }

        const [avatar, coverImage] = await Promise.all([
            handleUpload(avatarLocalPath),
            handleUpload(coverImageLocalPath),
        ]);

        if (!avatar.public_id || !avatar.secure_url) {
            deleteLocalFiles([coverImageLocalPath]);
            return next(new ApiError("Error uploading avatar", 400));
        }

        const avatar_public_id = avatar.public_id;
        const avatar_secure_url = avatar.secure_url;
        const coverImage_public_id = coverImage?.public_id || "";
        const coverImage_secure_url = coverImage?.secure_url || "";

        const user = await User.create({
            fullName,
            username: username.toLowerCase(),
            email,
            password,
            avatar: {
                public_id: avatar_public_id,
                secure_url: avatar_secure_url,
            },
            coverImage: {
                public_id: coverImage_public_id,
                secure_url: coverImage_secure_url,
            },
        });

        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        );

        if (!createdUser) {
            return next(new ApiError("Error creating user", 400));
        }

        res.status(201).json(
            new ApiResponse("User created successfully", createdUser)
        );
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
});

export const loginUser = asyncHandler(async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return next(new ApiError("All fields are required", 400));
        }

        const user = await User.findOne({
            $or: [{ username }, { email }],
        });

        if (!user) {
            return next(new ApiError("User not found", 404));
        }

        const isPasswordCorrect = await user.isPasswordCorrect(password);

        if (!isPasswordCorrect) {
            return next(new ApiError("Incorrect password", 400));
        }

        const { accessToken, refreshToken } =
            await generateAccessAndRefreshToken(user);

        const loggedInUser = await User.findById(user._id).select(
            "-password -refreshToken"
        );

        const options = {
            httpOnly: true,
            secure: true,
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse("Login successful", {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                })
            );
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
});

export const logoutUser = asyncHandler(async (req, res, next) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1,
            },
        },
        {
            new: true,
        }
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse("Logout successful", {}));
});

export const refreshAccessToken = asyncHandler(async (req, res, next) => {
    try {
        const cookieRefreshToken =
            req.cookies.refreshToken || req.body.refreshToken;

        if (!cookieRefreshToken) {
            return next(new ApiError("Unauthorized request", 401));
        }

        const decoded = jwt.verify(
            cookieRefreshToken,
            constants.REFRESH_TOKEN_SECRET
        );

        if (!decoded) {
            return next(new ApiError("Unauthorized request", 401));
        }

        const user = await User.findById(decoded?._id).select("-password");

        if (!user) {
            return next(new ApiError("Invalid access token", 401));
        }

        if (cookieRefreshToken !== user?.refreshToken) {
            return next(new ApiError("Refresh token is expired or used", 401));
        }

        const { accessToken, refreshToken } =
            await generateAccessAndRefreshToken(user);

        const options = {
            httpOnly: true,
            secure: true,
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse("Access token refreshed successfully", {
                    accessToken,
                    refreshToken,
                })
            );
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
});

export const changePassword = asyncHandler(async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return next(new ApiError("All fields are required", 400));
        }

        const user = await User.findById(req.user._id).select(
            "-password -refreshToken"
        );

        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

        if (!isPasswordCorrect) {
            return next(new ApiError("Incorrect old password", 400));
        }

        user.password = newPassword;
        user.save({ validateBeforeSave: false });

        res.status(200).json(
            new ApiResponse("Password changed successfully", {})
        );
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
});

export const getCurrentUser = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user._id).select(
        "-password -refreshToken"
    );

    res.status(200).json(new ApiResponse("Current user", user));
});

export const updateAccountDetails = asyncHandler(async (req, res, next) => {
    try {
        const { fullName, email } = req.body;

        if (!fullName || !email) {
            return next(new ApiError("All fields are required", 400));
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    fullName,
                    email,
                },
            },
            {
                new: true,
            }
        ).select("-password -refreshToken");

        res.status(200).json(
            new ApiResponse("Account details updated successfully", user)
        );
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
});

export const updateAvatar = asyncHandler(async (req, res, next) => {
    try {
        const avatarLocalPath = req.files.avatar
            ? req.files.avatar[0]?.path
            : "";

        if (!avatarLocalPath) {
            deleteLocalFiles([avatarLocalPath]);
            return next(new ApiError("Avatar is required", 400));
        }

        const avatar = await handleUpload(avatarLocalPath);

        if (!avatar.public_id || !avatar.secure_url) {
            deleteLocalFiles([avatarLocalPath]);
            return next(new ApiError("Unable to upload avatar", 400));
        }

        let user = await User.findById(req.user._id).select(
            "-password -refreshToken"
        );

        const result = await deleteFileFromCloudinary(user.avatar.public_id);

        if (!result) {
            return next(new ApiError("Unable to delete old avatar", 400));
        }

        user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    avatar: {
                        public_id: avatar.public_id,
                        secure_url: avatar.secure_url,
                    },
                },
            },
            {
                new: true,
            }
        ).select("-password -refreshToken");

        res.status(200).json(
            new ApiResponse("Avatar updated successfully", user)
        );
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
});

export const updateCoverImage = asyncHandler(async (req, res, next) => {
    try {
        const coverImageLocalPath = req.files.coverImage
            ? req.files.coverImage[0]?.path
            : "";

        if (!coverImageLocalPath) {
            deleteLocalFiles([coverImageLocalPath]);
            return next(new ApiError("Cover image is required", 400));
        }

        const coverImage = await handleUpload(coverImageLocalPath);

        if (!coverImage.public_id || !coverImage.secure_url) {
            deleteLocalFiles([avatarLocalPath]);
            return next(new ApiError("Unable to upload cover image", 400));
        }

        let user = await User.findById(req.user._id).select(
            "-password -refreshToken"
        );

        const result = await deleteFileFromCloudinary(
            user.coverImage.public_id
        );

        if (!result) {
            return next(new ApiError("Unable to delete old cover image", 400));
        }

        user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    coverImage: {
                        public_id: coverImage.public_id,
                        secure_url: coverImage.secure_url,
                    },
                },
            },
            {
                new: true,
            }
        ).select("-password -refreshToken");

        res.status(200).json(
            new ApiResponse("Cover image updated successfully", user)
        );
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
});

export const getUserChannelProfile = asyncHandler(async (req, res, next) => {
    try {
        const { username } = req.params;

        if (!username?.trim()) {
            return next(new ApiError("Username is required", 400));
        }

        const channel = User.aggregate([
            {
                $match: {
                    username: username?.toLowercase(),
                },
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers",
                },
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo",
                },
                $addFields: {
                    subscribersCount: {
                        $size: "$subscribers",
                    },
                    channelssubscribedToCount: {
                        $size: "$subscribedTo",
                    },
                    isSubscribed: {
                        $cond: {
                            if: {
                                $in: [req.user?._id, "$subscribers.subscriber"],
                            },
                            then: true,
                            else: false,
                        },
                    },
                },
                $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                    coverImage: 1,
                    subscribersCount: 1,
                    channelssubscribedToCount: 1,
                    isSubscribed: 1,
                    email: 1,
                },
            },
        ]);

        if (!channel?.length) {
            return next(new ApiError("Channel not found", 404));
        }

        return res
            .status(200)
            .json(new ApiResponse("Channel fetched successfully", channel[0]));
    } catch (error) {
        return next(new ApiError(error.message, 500));
    }
});

export const getWatchHistory = asyncHandler(async (req, res, next) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id),
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            owner: {
                                $arrayElemAt: ["$owner", 0],
                            },
                        },
                    },
                ],
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                "Watch history fetched successfully",
                user[0].watchHistory
            )
        );
});
