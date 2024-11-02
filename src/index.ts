import express, { Express } from "express";
import usersRouter from "./routes/users";
import authRouter from "./routes/auth";
import refreshRouter from "./routes/refresh";
import sessionsRouter from "./routes/sessions";
import collectionsRouter from "./routes/collections";
import cronRouter from "./routes/cron";
import postsRouter from "./routes/posts";
import feedRouter from "./routes/feed";
import searchRouter from "./routes/search";
import notificationsRouter from "./routes/notifications";
import { verifyJWT } from "./middleware/verifyJWT";
import { errorHandler } from "./middleware/errorHandler";

const app: Express = express();
const port = 8080;
const cookieParser = require("cookie-parser");

//middleware for json
app.use(express.json());

//middleware for cookies
app.use(cookieParser());

// Entry route
app.get("/", async (req, res) => {
  res.json("SKRRT SKRRT");
});

// Auth route
app.use("/api/auth", authRouter);

//Refresh route
app.use("/api/refresh", refreshRouter);

//cron-jobs
app.use("/cron", cronRouter);

//* Apply JWT verification middleware
app.use(verifyJWT);

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

//middleware for handling errors
app.use(errorHandler);

app.listen(port, () => {
  console.log(`app now running on port localhost:${port}`);
});
