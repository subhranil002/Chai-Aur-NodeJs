import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { handleUpload, deleteLocalFiles } from "../utils/handleCloudinary.js";
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

        if (!avatar) {
            return next(new ApiError("Error uploading avatar", 400));
        }

        const user = await User.create({
            fullName,
            username: username.toLowerCase(),
            email,
            password,
            avatar: avatar.secure_url,
            coverImage: coverImage?.secure_url || "",
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

        if (!username && !email && !password) {
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
    await User.findByIdAndUpdate(req.user._id, {
        $set: {
            refreshToken: null,
        },
    });

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
