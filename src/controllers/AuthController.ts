import { Response, Request } from "express";
import bcrypt from "bcrypt";
import PRISMA from "../utils/constants/prismaInstance";
import AppError from "../utils/types/errors";
import { asyncHandler } from "../middleware/asyncHandler";
import { deleteExpiredSessionsAndLogin } from "../utils/functions/reusablePrismaFunctions";
import { SESSION_LIMIT } from "../utils/constants/auth";

export default class AuthController {
  public login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password, os, browser, platform } = req.body;

    if (!email || !password) {
      throw new AppError(
        422,
        "Login Invalid. Please provide all needed credentials.",
        true
      );
    }

    //find the user by email (email is unique)
    const foundUser = await PRISMA.user.findFirst({
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
        userSessions: true,
        createdAt: true,
      },
    });

    if (!foundUser) {
      throw new AppError(422, "Incorrect Email or Password", true);
    }

    const currentDateTime = new Date();
    //if session limit has been exceeded, look for the user's sessions that have
    //expired sessions
    if (foundUser.userSessions.length >= SESSION_LIMIT) {
      const expiredSessions = await PRISMA.userSession.findMany({
        where: {
          userId: foundUser.id,
          expiresAt: {
            lt: currentDateTime,
          },
        },
      });

      //if there are no sessions with expired sessions, proceed in detachedMode
      if (expiredSessions.length === 0) {
        res.status(200).json({
          message: "Maximum session limit reached.",
          isDetachedMode: true,
          data: {
            user: {
              id: foundUser.id,
              username: foundUser.username,
              email: foundUser.email,
              handle: foundUser.handle,
              avatar: foundUser.avatar,
              password: foundUser.password,
            },
            sessions: foundUser.userSessions,
          },
        });
        return;
      }

      await deleteExpiredSessionsAndLogin({
        userAgentInfo: {
          browser,
          os,
          platform,
        },
        foundUser,
        password,
        currentDate: currentDateTime,
        res,
      });
    }
    //if session limit not exceeded, proceed to logging in.
    await deleteExpiredSessionsAndLogin({
      userAgentInfo: {
        browser,
        os,
        platform,
      },
      foundUser,
      password,
      currentDate: currentDateTime,
      res,
    });
  });

  public signUp = asyncHandler(async (req: Request, res: Response) => {
    const { username, email, password, handle } = req.body;
    if (!username || !email || !password || !handle) {
      throw new AppError(
        422,
        "Signup invalid. Please provide all the needed credentials.",
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

    await PRISMA.user.create({
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
      const cookies = req.cookies;
      const tokenFromCookies = cookies.sessionToken;

      //find the userSession that has that session token
      const foundUserSession = await PRISMA.userSession.findFirst({
        where: {
          token: tokenFromCookies,
        },
      });

      if (!foundUserSession) {
        throw new AppError(404, "Session not found.", true);
      }

      //if user session found,
      //Delete that userSession using the foundUserSession's sessionId (primary key)
      await PRISMA.userSession.delete({
        where: {
          id: foundUserSession.id,
        },
      });
      //and also clear the cookie
      res.clearCookie("sessionToken", {
        httpOnly: true,
        secure: !!Number(process.env.IS_PROD),
      });
      res.status(200).json("Found user session. Successfully logged out.");
    }
  );

  public logoutSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    //Delete the row with the sessionId in the UserSession table
    await PRISMA.userSession.delete({
      where: {
        id: sessionId,
      },
    });
    res
      .status(200)
      .json(`Session with id ${sessionId} logged out successfully.`);
  });

  public checkHandleAvailabilty = asyncHandler(
    async (req: Request, res: Response) => {
      const { handle } = req.query;

      if (!handle) {
        throw new AppError(422, "Handle not provided.", true);
      }

      const foundHandleDupe = await PRISMA.user.findFirst({
        where: {
          handle: handle.toString(),
        },
      });

      if (foundHandleDupe) {
        throw new AppError(
          409,
          "This handle is already associated with another account.",
          true
        );
      }

      res.status(200).json({
        message: "handle is available.",
      });
    }
  );

  public checkEmailAvailability = asyncHandler(
    async (req: Request, res: Response) => {
      const { email } = req.query;

      if (!email) {
        throw new AppError(422, "No email provided.", true);
      }

      const foundEmailDupe = await PRISMA.user.findFirst({
        where: {
          email: email.toString(),
        },
      });

      if (foundEmailDupe) {
        throw new AppError(
          409,
          "This email is already associated with another account.",
          true
        );
      }

      res.status(200).json({
        message: "email is available.",
      });
    }
  );

  public findUserByEmail = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.query;

    if (!email) {
      throw new AppError(422, "Email not provided", true);
    }

    const foundUser = await PRISMA.user.findFirstOrThrow({
      where: {
        email: email.toString(),
      },
      select: {
        id: true,
        avatar: true,
        email: true,
        username: true,
        handle: true,
      },
    });

    res.status(200).json({
      message: "success",
      data: foundUser,
    });
  });

  public updatePassword = asyncHandler(async (req: Request, res: Response) => {
    const { userId, newPassword } = req.body;

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await PRISMA.user.update({
      where: {
        id: userId,
      },
      data: {
        password: hashedNewPassword,
      },
    });

    res.status(200).json({
      message: "Password updated successfully.",
    });
  });
}
