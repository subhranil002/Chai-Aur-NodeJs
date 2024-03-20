import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

const handleUpload = async (localFilePath) => {
    if (!localFilePath) return null;

    try {
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            folder: "Chai-Aur-NodeJS",
        });

        fs.unlinkSync(localFilePath);
        console.log("File uploaded successfully");

        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath);
        console.log("File upload failed", error);
        return null;
    }
};

export { handleUpload };
