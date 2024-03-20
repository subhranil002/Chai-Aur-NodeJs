import { v2 as cloudinary } from "cloudinary";
import constants from "../constants.js";
import ApiError from "../utils/ApiError.js";

const connectToCloudinary = async () => {
    try {
        await cloudinary.config({
            cloud_name: constants.CLOUDINARY_CLOUD_NAME,
            api_key: constants.CLOUDINARY_API_KEY,
            api_secret: constants.CLOUDINARY_API_SECRET,
        });

        console.log("Connected to Cloudinary successfully!");
    } catch (error) {
        return new ApiError(
            `Error connecting to Cloudinary: ${error.message}`,
            500
        );
    }
};

export default connectToCloudinary;
