import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import PRISMA from "../utils/constants/prismaInstance";
import AppError from "../utils/types/errors";
import { compare, hash } from "bcrypt";
import { RequestWithSession } from "../utils/types/session";

export default class AccountController {
  public updateUserDetails = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;
    const { avatar, banner, username, bio } = req.body;

    const updatedUserDetails = await PRISMA.user.update({
      where: {
        id: session.userId,
      },
      data: {
        avatar,
        banner,
        username,
        bio,
      },
      select: {
        id: true,
        avatar: true,
        banner: true,
        username: true,
        bio: true,
      },
    });

    res.status(200).json({
      message: "profile updated successfully.",
      data: updatedUserDetails,
    });
  });

  public verifyPassword = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const { password } = req.body;
    const session = req.session;
    if (!password) {
      throw new AppError(422, "No password provided. ", true);
    }

    const foundUser = await PRISMA.user.findFirstOrThrow({
      where: {
        id: session.userId,
      },
      select: {
        password: true,
      },
    });

    const matchedPassword = await compare(
      password.toString(),
      foundUser.password
    );

    if (!matchedPassword) {
      throw new AppError(400, "Given password is incorrect.", true);
    }

    res.status(200).json({
      message: "Password verified.",
    });
  });

  public updatePassword = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;
    const { password } = req.body;

    if (!password) {
      throw new AppError(422, "No password provided.", true);
    }

    //hash the password
    const hashedPassword = await hash(password, 10);

    await PRISMA.user.update({
      where: {
        id: session.userId,
      },
      data: {
        password: hashedPassword,
      },
    });

    res.status(200).json({
      message: "password updated successfully.",
    });
  });

  public updateEmail = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;
    const { email } = req.body;

    if (!email) {
      throw new AppError(400, "Email not provided.", true);
    }

    await PRISMA.user.update({
      where: {
        id: session.userId,
      },
      data: {
        email,
      },
    });

    res.status(200).json({
      message: "email updated successfully.",
    });
  });

  public updateHandle = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;
    const { handle } = req.body;

    if (!handle) {
      throw new AppError(400, "Handle not provied.", true);
    }

    await PRISMA.user.update({
      where: {
        id: session.userId,
      },
      data: {
        handle,
      },
    });

    res.status(200).json({
      message: "handle updated successfully.",
    });
  });

  public deleteAccount = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithSession;
    const session = req.session;

    await PRISMA.user.delete({
      where: {
        id: session.userId,
      },
    });

    //delete notifs where the notification actor is solely the current user
    await PRISMA.notification.deleteMany({
      where: {
        actors: {
          every: {
            actorId: session.userId
          }
        },
      },
    })

    res.clearCookie("sessionToken", {
      httpOnly: true,
      sameSite: "none",
      secure: !!Number(process.env.IS_PROD),
      // path: '/',
      // domain: process.env.DOMAIN
    });

    res.status(200).json({
      message: "account deleted successfully.",
    });
  });
}
