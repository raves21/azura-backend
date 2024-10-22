import express, { Express } from "express";
import usersRouter from "./routes/users";
import authRouter from "./routes/auth";
import refreshRouter from "./routes/refresh";
import sessionsRouter from "./routes/sessions";
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

//* Apply JWT verification middleware
app.use(verifyJWT);

// Users route (protected by verifyJWT)
app.use("/api/users", usersRouter);

// Sessions route (protected by verifyJWT)
app.use("/api/sessions", sessionsRouter);

//middleware for handling errors
app.use(errorHandler);

app.listen(port, () => {
  console.log(`app now running on port localhost:${port}`);
});
