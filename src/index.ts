import express, { Express } from "express";
import userRouter from "./routes/user";
import authRouter from "./routes/auth";
import refreshRouter from "./routes/refresh";
import { verifyJWT } from "./middleware/verifyJWT";

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
app.use("/api/refresh", refreshRouter);

// Apply JWT verification middleware
app.use(verifyJWT);

// Users route (protected by verifyJWT)
app.use("/api/user", userRouter);

app.listen(port, () => {
  console.log(`app now running on port localhost:${port}`);
});
