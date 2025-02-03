import PRISMA from "../utils/constants/prismaInstance";
import { NextFunction, Request, Response } from "express";
import { verify, sign } from "jsonwebtoken";
import { CustomJWTPayload } from "../utils/types/jwt";
import { TokenExpiredError } from "jsonwebtoken";
import AppError from "../utils/types/errors";
import { asyncHandler } from "../middleware/asyncHandler";
import { ACCESS_TOKEN_DURATION } from "../utils/constants/auth";

export default class RefreshTokenController {
  public grantNewAccessToken = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const cookies = req.cookies;

      if (!cookies?.refreshToken) {
        throw new AppError(401, "Unauthorized", "No JWT in cookies!", true);
      }

      const refreshTokenFromCookies = cookies.refreshToken as string;

      //find the userSession and user using the refreshToken (refreshToken is unique)
      const foundUserSession = await PRISMA.userSession.findFirstOrThrow({
        where: {
          refreshToken: refreshTokenFromCookies
        },
        include: {
          user: true
        }
      });

      const foundUser = foundUserSession.user;

      verify(
        refreshTokenFromCookies,
        process.env.REFRESH_TOKEN_SECRET as string,
        async (err, decoded) => {
          const payload = decoded as CustomJWTPayload;
          try {
            if (err) {
              if (err instanceof TokenExpiredError) {
                //if refresh token is expired, delete the session.
                await PRISMA.userSession.delete({
                  where: {
                    sessionId: foundUserSession.sessionId
                  }
                });
                throw new TokenExpiredError(
                  "Your session has expired.",
                  new Date()
                );
              } else if (foundUser.id !== payload.userId) {
                throw new AppError(
                  401,
                  "Unauthorized.",
                  "Grant new access token failed.",
                  true
                );
              } else {
                throw err;
              }
            }

            //issue a new access token
            const newAccessToken = sign(
              {
                userId: foundUser.id,
                sessionId: foundUserSession.sessionId,
                email: foundUser.email,
                handle: foundUser.handle
              },
              process.env.ACCESS_TOKEN_SECRET as string,
              { expiresIn: ACCESS_TOKEN_DURATION }
            );
            console.log("TOKEN REFRESHED!");
            res.json({
              message: "U are granted a new access token!",
              data: {
                currentUserBasicInfo: {
                  id: foundUser.id,
                  username: foundUser.username,
                  handle: foundUser.handle,
                  email: foundUser.email,
                  avatar: foundUser.avatar
                },
                accessToken: newAccessToken
              }
            });
          } catch (error) {
            next(error);
          }
        }
      );
    }
  );
}
