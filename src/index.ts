import express, { Express } from "express";
import usersRouter from "./routes/users";
import authRouter from "./routes/auth";
import sessionsRouter from "./routes/sessions";
import collectionsRouter from "./routes/collections";
import cronRouter from "./routes/cron";
import postsRouter from "./routes/posts";
import feedRouter from "./routes/feed";
import searchRouter from "./routes/search";
import notificationsRouter from "./routes/notifications";
import trendingRouter from "./routes/trending";
import otcRouter from "./routes/otc";
import accountRouter from "./routes/account";
import discoverPeopleRouter from "./routes/discoverPeople";
import { verifySessionToken } from "./middleware/verifySessionToken";
import { errorHandler } from "./middleware/errorHandler";
import cors from "cors";

const app: Express = express();
const port = process.env.PORT;
const cookieParser = require("cookie-parser");

//middleware for cors
app.use(
  cors({
    origin: JSON.parse(`${process.env.ALLOW_ORIGIN_LIST}`),
    credentials: true,
  })
);

//middleware for cookies
app.use(cookieParser());

//middleware for json
app.use(express.json());

// Entry route
app.get("/", (req, res) => {
  res.json("HELLO FROM DOCKERRRRRR");
});

// Auth route
app.use("/api/auth", authRouter);

// OTC route
app.use("/api/otc", otcRouter);

// Route for cron-jobs
app.use("/api/cron", cronRouter);

//* Apply token verification middleware
app.use(verifySessionToken);

// Route for checking token validity in the frontend
app.get("/api/check-token", (_, res) => {
  res.status(200).json("token valid");
});

// Users route
app.use("/api/users", usersRouter);

// Sessions route
app.use("/api/sessions", sessionsRouter);

// Collections route
app.use("/api/collections", collectionsRouter);

// Posts route
app.use("/api/posts", postsRouter);

// Feed route
app.use("/api/feed", feedRouter);

// Search route
app.use("/api/search", searchRouter);

// Notifications route
app.use("/api/notifications", notificationsRouter);

// Trending route
app.use("/api/trending", trendingRouter);

// Account route
app.use("/api/account", accountRouter);

// Discover people route
app.use("/api/discover-people", discoverPeopleRouter);

//middleware for handling errors
app.use(errorHandler);

app.listen(port, () => {
  console.log(`app now running on port localhost:${port}`);
});

export default app;
