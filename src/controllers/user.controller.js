import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { handleUpload } from "../utils/handleCloudinary.js";

export const registerUser = asyncHandler(async (req, res, next) => {
    try {
        const { fullName, username, email, password } = req.body;

        if (
            [fullName, username, email, password].some(
                (field) => field?.trim() === ""
            )
        ) {
            return next(new ApiError("All fields are required", 400));
        }

        const userExists = await User.findOne({
            $or: [{ username }, { email }],
        });

        if (userExists) {
            return next(new ApiError("User already exists", 409));
        }

        const avatarLocalPath = req.files.avatar
            ? req.files.avatar[0]?.path
            : null;
        const coverImageLocalPath = req.files.coverImage
            ? req.files.coverImage[0]?.path
            : null;

        if (!avatarLocalPath) {
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
