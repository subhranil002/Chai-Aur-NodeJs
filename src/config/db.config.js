import mongoose from "mongoose";
import constants from "../constants.js";

const dbConfig = async () => {
    try {
        const connectionInstance = await mongoose.connect(
            constants.MONGO_URI,
            {
                dbName: constants.DB_NAME,
            }
        );

        console.log(`MongoDB Connected: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log("Error while connecting to MongoDB: ", error);
        process.exit(1);
    }
};

export default dbConfig;
