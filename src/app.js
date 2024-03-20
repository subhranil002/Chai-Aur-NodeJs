import express, { urlencoded } from "express";
const app = express();
import cors from "cors";
import cookieParser from "cookie-parser";
import constants from "./constants.js";
import userRouter from "./routes/user.route.js";
import errorMiddleWare from "./middlewares/error.middleware.js";

app.use(
    cors({
        origin: constants.CORS_ORIGIN,
        credentials: true,
    })
);
app.use(express.json());
app.use(
    express.urlencoded({
        extended: true,
    })
);
app.use(express.static("public"));
app.use(cookieParser());

app.use("/api/v1/user", userRouter);

app.use(errorMiddleWare);

export default app;
