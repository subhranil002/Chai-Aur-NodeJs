import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

const deleteLocalFiles = (localFiles) => {
    if (localFiles && localFiles.length > 0) {
        for (let index = 0; index < localFiles.length; index++) {
            const filePath = localFiles[index];
            if (filePath !== "") {
                fs.unlinkSync(filePath);
            }
        }
    }
};

const handleUpload = async (localFilePath) => {
    if (!localFilePath) return null;

    try {
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            folder: "Chai-Aur-NodeJS",
        });

        deleteLocalFiles([localFilePath]);
        console.log("File uploaded successfully");

        return response;
    } catch (error) {
        deleteLocalFiles([localFilePath]);
        console.log("File upload failed", error);
        return null;
    }
};

export { handleUpload, deleteLocalFiles };
