import "dotenv/config";
import app from "./app.js";
import dbConfig from "./config/db.config.js";
import constants from "./constants.js";
import connectToCloudinary from "./config/cloudinary.config.js";

dbConfig().then(() => {
    connectToCloudinary();
    app.listen(constants.PORT, () => {
        console.log(`Server is running on http://localhost:${constants.PORT}`);
    });
});
