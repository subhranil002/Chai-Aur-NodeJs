import { Router } from "express";
import {
    changePassword,
    getCurrentUser,
    getUserChannelProfile,
    getWatchHistory,
    loginUser,
    logoutUser,
    refreshAccessToken,
    registerUser,
    updateAccountDetails,
    updateAvatar,
    updateCoverImage,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyAccessToken } from "../middlewares/auth.middleware.js";

const userRouter = Router();

userRouter.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1,
        },
        {
            name: "coverImage",
            maxCount: 1,
        },
    ]),
    registerUser
);
userRouter.route("/login").post(loginUser);
userRouter.route("/logout").get(verifyAccessToken, logoutUser);
userRouter.route("/refresh-token").get(refreshAccessToken);
userRouter.route("/change-password").post(verifyAccessToken, changePassword);
userRouter.route("/current-user").get(verifyAccessToken, getCurrentUser);
userRouter
    .route("update-account")
    .patch(verifyAccessToken, updateAccountDetails);
userRouter
    .route("update-avatar")
    .patch(verifyAccessToken, upload.single("avatar"), updateAvatar);
userRouter
    .route("update-cover")
    .patch(verifyAccessToken, upload.single("coverImage"), updateCoverImage);
userRouter
    .route("/channel/:username")
    .get(verifyAccessToken, getUserChannelProfile);
userRouter.route("/watch-history").get(verifyAccessToken, getWatchHistory);

export default userRouter;
