import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import PRISMA from "../utils/constants/prismaInstance";
import AppError from "../utils/types/errors";
import { compare, hash } from "bcrypt";
import { RequestWithPayload } from "../utils/types/jwt";

export default class ProfileController {
  public updateUserDetails = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const payload = req.jwtPayload;
    const { avatar, banner, username, bio } = req.body;

    const updatedUserDetails = await PRISMA.user.update({
      where: {
        id: payload.userId
      },
      data: {
        avatar,
        banner,
        username,
        bio
      },
      select: {
        id: true,
        avatar: true,
        banner: true,
        username: true,
        bio: true
      }
    });

    res.status(200).json({
      message: "profile updated successfully.",
      data: updatedUserDetails
    });
  });

  public verifyPassword = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const { password } = req.query;
    const payload = req.jwtPayload;
    if (!password) {
      throw new AppError(
        422,
        "Invalid format.",
        "No password provided. ",
        true
      );
    }

    const foundUser = await PRISMA.user.findFirstOrThrow({
      where: {
        id: payload.userId
      }
    });

    const matchedPassword = await compare(
      password.toString(),
      foundUser.password
    );

    if (!matchedPassword) {
      throw new AppError(
        400,
        "Incorrect",
        "Given password is incorrect.",
        true
      );
    }

    res.status(200).json({
      message: "Password verified."
    });
  });

  public updatePassword = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const payload = req.jwtPayload;
    const { password } = req.body;

    if (!password) {
      throw new AppError(422, "Invalid format.", "No password provided.", true);
    }

    //hash the password
    const hashedPassword = await hash(password, 10);

    await PRISMA.user.update({
      where: {
        id: payload.userId
      },
      data: {
        password: hashedPassword
      }
    });

    res.status(200).json({
      message: "password updated successfully."
    });
  });

  public updateEmail = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const payload = req.jwtPayload;
    const { email } = req.body;

    await PRISMA.user.update({
      where: {
        id: payload.userId
      },
      data: {
        email
      }
    });

    res.status(200).json({
      message: "email updated successfully."
    });
  });

  public deleteAccount = asyncHandler(async (_: Request, res: Response) => {
    const req = _ as RequestWithPayload;
    const payload = req.jwtPayload;

    await PRISMA.user.delete({
      where: {
        id: payload.userId
      }
    });

    res.status(200).json({
      message: "account deleted successfully."
    });
  });
}
