import { Response, Request } from "express";
import bcrypt from "bcrypt";
import PRISMA from "../utils/constants/prismaInstance";
import AppError from "../utils/types/errors";
import { asyncHandler } from "../middleware/asyncHandler";
import { deleteExpiredSessionsAndLogin } from "../utils/functions/reusablePrismaFunctions";
import { SESSION_LIMIT } from "../utils/constants/auth";

export default class AuthController {
  public login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError(
        422,
        "Invalid Format.",
        "Login Invalid. Please provide all needed credentials.",
        true
      );
    }

    //find the user by email (email is unique)
    const foundUser = await PRISMA.user.findFirstOrThrow({
      where: {
        email
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
            refreshTokenExpiresAt: true
          }
        },
        createdAt: true
      }
    });

    const currentDateTime = new Date();
    //if session limit has been exceeded, look for the user's sessions that have
    //expired refreshTokens
    if (foundUser.userSessions.length >= SESSION_LIMIT) {
      const expiredSessions = await PRISMA.userSession.findMany({
        where: {
          userId: foundUser.id,
          refreshTokenExpiresAt: {
            lt: currentDateTime
          }
        }
      });

      //if there are no sessions with expired refreshTokens, proceed in detachedMode
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
              avatar: foundUser.avatar
            },
            sessions: foundUser.userSessions
          }
        });
        return;
      }

      await deleteExpiredSessionsAndLogin({
        foundUser,
        password,
        currentDate: currentDateTime,
        res
      });
    }
    //if session limit not exceeded, proceed to logging in.
    await deleteExpiredSessionsAndLogin({
      foundUser,
      password,
      currentDate: currentDateTime,
      res
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

    //encrypt the password
    const encryptedPassword = await bcrypt.hash(password, 10);

    //store the new user in the db
    const newUser = {
      email,
      username,
      handle
    };

    await PRISMA.user.create({
      data: {
        ...newUser,
        password: encryptedPassword
      }
    });

    res.status(201).json({
      message: "success, new user created",
      data: newUser
    });
  });

  public logoutCurrentSession = asyncHandler(
    async (req: Request, res: Response) => {
      //*NOTE: On client, also delete accessToken or set to null or something

      const cookies = req.cookies;
      const refreshTokenFromCookies = cookies.refreshToken;

      //find the userSession that has that refreshToken
      const foundUserSession = await PRISMA.userSession.findFirstOrThrow({
        where: {
          refreshToken: refreshTokenFromCookies
        }
      });

      //if user session found,
      //Delete that userSession using the foundUserSession's sessionId (primary key)
      await PRISMA.userSession.delete({
        where: {
          sessionId: foundUserSession.sessionId
        }
      });
      //and also clear the cookie
      res.clearCookie("refreshToken", {
        httpOnly: true
        //! TODO IN PRODUCTION: provide 'secure: true' in the clearCookie options
      });
      res.status(200).json("Found user session. Successfully logged out.");
    }
  );

  public logoutSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    //Delete the row with the sessionId in the UserSession table
    await PRISMA.userSession.delete({
      where: {
        sessionId
      }
    });
    res
      .status(200)
      .json(`Session with id ${sessionId} logged out successfully.`);
  });

  public checkHandleAvailabilty = asyncHandler(
    async (req: Request, res: Response) => {
      const { handle } = req.query;

      if (!handle) {
        throw new AppError(422, "Invalid Format", "Handle not provided.", true);
      }

      const foundHandleDupe = await PRISMA.user.findFirst({
        where: {
          handle: handle.toString()
        }
      });

      if (foundHandleDupe) {
        throw new AppError(
          409,
          "Conflict",
          "This handle is already associated with another account.",
          true
        );
      }

      res.status(200).json({
        message: "handle is available."
      });
    }
  );

  public checkEmailAvailability = asyncHandler(
    async (req: Request, res: Response) => {
      const { email } = req.query;

      if (!email) {
        throw new AppError(422, "Invalid Format.", "No email provided.", true);
      }

      const foundEmailDupe = await PRISMA.user.findFirst({
        where: {
          email: email.toString()
        }
      });

      if (foundEmailDupe) {
        throw new AppError(
          409,
          "Conflict",
          "This email is already associated with another account.",
          true
        );
      }

      res.status(200).json({
        message: "email is available."
      });
    }
  );

  public findUserByEmail = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.query;

    if (!email) {
      throw new AppError(422, "Invalid Format.", "Email not provided", true);
    }

    const foundUser = await PRISMA.user.findFirstOrThrow({
      where: {
        email: email.toString()
      },
      select: {
        id: true,
        avatar: true,
        email: true,
        username: true,
        handle: true
      }
    });

    res.status(200).json({
      message: "success",
      data: foundUser
    });
  });

  public updatePassword = asyncHandler(async (req: Request, res: Response) => {
    const { userId, newPassword } = req.body;

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await PRISMA.user.update({
      where: {
        id: userId
      },
      data: {
        password: hashedNewPassword
      }
    });

    res.status(200).json({
      message: "Password updated successfully."
    });
  });
}
