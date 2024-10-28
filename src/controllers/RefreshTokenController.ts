import { PrismaClient } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { verify, sign } from "jsonwebtoken";
import { CustomJWTPayload } from "../utils/types/jwt";
import { TokenExpiredError } from "jsonwebtoken";
import AppError from "../utils/types/errors";
import { asyncHandler } from "../middleware/asyncHandler";

const prisma = new PrismaClient();

export default class RefreshTokenController {
  public grantNewAccessToken = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const cookies = req.cookies;
      const currentUserPayload = req.jwtPayload;

      if (!cookies?.refreshToken) {
        throw new AppError(401, "Unauthorized.", "No JWT in cookies!", true);
      }

      const refreshTokenFromCookies = cookies.refreshToken as string;

      //find the userSession and user using the refreshToken (refreshToken is unique)
      const foundUserSession = await prisma.userSession.findFirst({
        where: {
          refreshToken: refreshTokenFromCookies,
        },
        include: {
          user: true,
        },
      });

      //if userSession is not found, then that means someone/the user himself logged that session out
      //(logging out means the session is deleted in the UserSession table)
      if (!foundUserSession) {
        throw new AppError(
          403,
          "NotFoundError",
          "Failed granting new access token. User session not found.",
          true
        );
      }

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
                await prisma.userSession.delete({
                  where: {
                    sessionId: foundUserSession.sessionId,
                  },
                });
                throw new TokenExpiredError(
                  "Your session has expired.",
                  currentUserPayload.exp
                );
              } else if (foundUser.id !== payload.userId) {
                throw new AppError(
                  403,
                  "Forbidden",
                  "Unauthorized. Grant new access token failed.",
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
              },
              process.env.ACCESS_TOKEN_SECRET as string,
              { expiresIn: "30m" }
            );
            res.json({
              message: "U are granted a new access token!",
              data: {
                accessToken: newAccessToken,
              },
            });
          } catch (error) {
            next(error);
          }
        }
      );
    }
  );
}
