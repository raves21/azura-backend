import { Response, Request } from "express";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { sign } from "jsonwebtoken";

const prisma = new PrismaClient();

export default class AuthController {
  public async login(req: Request, res: Response) {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({
        message: "Login Invalid. Please provide all needed credentials.",
      });
      return;
    }

    //find the user by email (email is unique)
    const foundUser = await prisma.user.findFirst({
      where: {
        email,
      },
    });

    //if user not found, throw error.
    if (!foundUser) {
      res.status(401).json({
        message: "Unauthorized.",
      });
      return;
    }
    //evaluate password
    const matchedPassword = await bcrypt.compare(password, foundUser.password);

    //if passwords dont match throw error.
    if (!matchedPassword) {
      res.status(403).json({
        message: "Invalid credentials.",
      });
      return;
    }

    //if passwords DO match, then create refreshToken
    const refreshToken = sign(
      {
        userId: foundUser.id,
        email: foundUser.email,
      },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: "3m" }
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
      },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "2m" }
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, //1 day
      //! TODO IN PRODUCTION: provide 'secure: true' in the clearCookie options
    });
    res.status(200).json({
      message: `You are now logged in as ${foundUser.username}`,
      data: {
        user: foundUser,
        accessToken,
      },
    });
  }

  public async signUp(req: Request, res: Response) {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      res.status(400).json({
        message: "Signup Invalid. Please provide all the needed credentials.",
      });

    try {
      //encrypt the password
      const encryptedPassword = await bcrypt.hash(password, 10);

      //store the new user in the db
      const newUser = {
        email,
        password: encryptedPassword,
        username,
      };

      await prisma.user.create({
        data: newUser,
      });

      res.status(201).json({
        message: "success, new user created",
        data: newUser,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "an unknown error occured.",
      });
    }
  }

  public async logoutSelf(req: Request, res: Response) {
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

    if (!foundUserSession) {
      res.status(200).json("User session not found. Successfully logged out.");
      return;
    }

    //Delete that userSession using the foundUserSession's sessionId (since that is the primary key)
    await prisma.userSession.delete({
      where: {
        sessionId: foundUserSession?.sessionId,
      },
    });
    //and also clear the cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
    });
    res.status(200).json("Found user session. Successfully logged out.");
  }
}
