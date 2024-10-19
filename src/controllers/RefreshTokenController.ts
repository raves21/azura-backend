import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { verify, sign } from "jsonwebtoken";
import { CustomJWTPayload } from "../utils/types";
import { TokenExpiredError } from "jsonwebtoken";

const prisma = new PrismaClient();

export default class RefreshTokenController {
  public async grantNewAccessToken(req: Request, res: Response) {
    const cookies = req.cookies;

    if (!cookies?.refreshToken) {
      res.status(401).json("No refresh token in cookies!");
      return;
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
      res.status(403).json({
        message: "Failed granting new access token. User session not found.",
      });
      return;
    }

    const foundUser = foundUserSession.user;

    verify(
      refreshTokenFromCookies,
      process.env.REFRESH_TOKEN_SECRET as string,
      async (err, decoded) => {
        const payload = decoded as CustomJWTPayload;
        if (err) {
          if (err instanceof TokenExpiredError) {
            //if refresh token is expired, delete the session.
            await prisma.userSession.delete({
              where: {
                sessionId: foundUserSession.sessionId,
              },
            });
            res
              .status(403)
              .json("Refresh token expired. Grant new access token failed.");
          } else if (foundUser.id !== payload.userId) {
            res
              .status(403)
              .json("Unauthorized. Grant new access token failed.");
          } else {
            res.status(403).json(err.message);
          }
          return;
        }

        console.log("PAYLOAD OF REFRESH", payload);
        //issue a new access token
        const newAccessToken = sign(
          {
            userId: foundUser.id,
            sessionId: foundUserSession.sessionId,
            email: foundUser.email,
          },
          process.env.ACCESS_TOKEN_SECRET as string,
          { expiresIn: "1m" }
        );
        res.json({
          message: "U are granted a new access token!",
          data: {
            accessToken: newAccessToken,
          },
        });
      }
    );
  }
}
