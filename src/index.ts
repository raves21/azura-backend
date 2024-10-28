import express, { Express } from "express";
import usersRouter from "./routes/users";
import authRouter from "./routes/auth";
import refreshRouter from "./routes/refresh";
import sessionsRouter from "./routes/sessions";
import collectionsRouter from "./routes/collections";
import cronRouter from "./routes/cron";
import postsRouter from "./routes/posts";
import { verifyJWT } from "./middleware/verifyJWT";
import { errorHandler } from "./middleware/errorHandler";
import { verifySession } from "./middleware/verifySession";

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

app.use(verifySession);

// Users route (protected by verifyJWT)
app.use("/api/users", usersRouter);

// Sessions route (protected by verifyJWT)
app.use("/api/sessions", sessionsRouter);

// Collections route (protected by verifyJWT)
app.use("/api/collections", collectionsRouter);

// Posts route (protected by verifyJWT)
app.use("/api/posts", postsRouter);

//middleware for handling errors
app.use(errorHandler);

app.listen(port, () => {
  console.log(`app now running on port localhost:${port}`);
});
