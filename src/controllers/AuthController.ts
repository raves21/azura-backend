import { Response, Request } from "express";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { sign } from "jsonwebtoken";
import AppError from "../utils/types/errors";
import { asyncHandler } from "../middleware/asyncHandler";

const prisma = new PrismaClient();

export default class AuthController {
  public login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const sessionLimit = 2;

    if (!email || !password) {
      throw new AppError(
        422,
        "Invalid Format.",
        "Login Invalid. Please provide all needed credentials.",
        true
      );
    }

    //find the user by email (email is unique)
    const foundUser = await prisma.user.findFirst({
      where: {
        email,
      },
      select: {
        id: true,
        username: true,
        email: true,
        password: true,
        handle: true,
        avatar: true,
        userSessions: {
          select: {
            userId: true,
            deviceName: true,
            sessionId: true,
            createdAt: true,
          },
        },
        createdAt: true,
      },
    });

    //if user not found, throw error.
    if (!foundUser) {
      throw new AppError(401, "Unathorized", "User not found.", true);
    }

    //check if user session has reached session limit
    const currentUserSessions = foundUser.userSessions;
    if (currentUserSessions.length >= sessionLimit) {
      res.status(200).json({
        message: "Maximum session limit reached.",
        isDetachedMode: true,
        data: {
          id: foundUser.id,
          username: foundUser.username,
          email: foundUser.email,
          handle: foundUser.handle,
          avatar: foundUser.avatar,
          sessions: currentUserSessions,
        },
      });
      return;
    }

    //evaluate password
    const matchedPassword = await bcrypt.compare(password, foundUser.password);

    //if passwords dont match throw error.
    if (!matchedPassword) {
      throw new AppError(
        422,
        "Invalid Format.",
        "Incorrect Email or Password",
        true
      );
    }

    //if passwords DO match, then create refreshToken
    const refreshToken = sign(
      {
        userId: foundUser.id,
        email: foundUser.email,
        handle: foundUser.handle,
      },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: "1d" }
    );

    //save user's session in the UserSession table, along with their refreshToken
    const newlyCreatedUserSession = await prisma.userSession.create({
      data: {
        userId: foundUser.id,
        deviceName: `unknown device`,
        refreshToken,
      },
    });

    //create accessToken, including sessionId in its payload
    const accessToken = sign(
      {
        userId: foundUser.id,
        sessionId: newlyCreatedUserSession.sessionId,
        email: foundUser.email,
        handle: foundUser.handle,
      },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "30m" }
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, //1 day
      //! TODO IN PRODUCTION: provide 'secure: true' in the clearCookie options
    });
    res.status(200).json({
      message: `You are now logged in as ${foundUser.username}`,
      data: {
        user: {
          id: foundUser.id,
          username: foundUser.username,
          email: foundUser.email,
          handle: foundUser.handle,
          avatar: foundUser.avatar,
          createdAt: foundUser.createdAt,
        },
        isDetachedMode: false,
        accessToken,
      },
    });
  });

  public signUp = asyncHandler(async (req: Request, res: Response) => {
    const { username, email, password, handle } = req.body;
    if (!username || !email || !password || !handle) {
      throw new AppError(
        422,
        "Invalid Format.",
        "Signup invalid. Please provide all the needed credentials.",
        true
      );
    }

    //check for duplicate email in the db
    const foundEmailDupe = await prisma.user.findFirst({
      where: {
        email,
      },
    });

    if (foundEmailDupe) {
      throw new AppError(
        409,
        "Conflict",
        "This email is already associated with another account.",
        true
      );
    }

    //check for duplicate handle in the db
    const foundHandleDupe = await prisma.user.findFirst({
      where: {
        handle,
      },
    });

    if (foundHandleDupe) {
      throw new AppError(
        409,
        "Conflict",
        "This handle is already associated with another account.",
        true
      );
    }

    //encrypt the password
    const encryptedPassword = await bcrypt.hash(password, 10);

    //store the new user in the db
    const newUser = {
      email,
      username,
      handle,
    };

    await prisma.user.create({
      data: {
        ...newUser,
        password: encryptedPassword,
      },
    });

    res.status(201).json({
      message: "success, new user created",
      data: newUser,
    });
  });

  public logoutCurrentSession = asyncHandler(
    async (req: Request, res: Response) => {
      //*NOTE: On client, also delete accessToken or set to null or something

      //NOTE: this function has no error handling if cookies.refreshToken
      //does not exist, because it will always exist (all user actions has cookies attached).
      //And even if refreshToken in cookies is expired, we can still use that to
      //query the UserSession table to find our session and delete it.

      const cookies = req.cookies;
      const refreshTokenFromCookies = cookies.refreshToken;

      //find the userSession that has that refreshToken
      const foundUserSession = await prisma.userSession.findFirst({
        where: {
          refreshToken: refreshTokenFromCookies,
        },
      });

      //user session was already deleted in the UserSession table (omae wa mo logged out)
      if (!foundUserSession) {
        res
          .status(200)
          .json("User session not found. Successfully logged out.");
        return;
      }

      //Delete that userSession using the foundUserSession's sessionId (since that is the primary key)
      await prisma.userSession.delete({
        where: {
          sessionId: foundUserSession.sessionId,
        },
      });
      //and also clear the cookie
      res.clearCookie("refreshToken", {
        httpOnly: true,
        //! TODO IN PRODUCTION: provide 'secure: true' in the clearCookie options
      });
      res.status(200).json("Found user session. Successfully logged out.");
    }
  );

  public logoutSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    //Delete the row with the sessionId in the UserSession table
    await prisma.userSession.delete({
      where: {
        sessionId,
      },
    });
    res
      .status(200)
      .json(`Session with id ${sessionId} logged out successfully.`);
  });
}
