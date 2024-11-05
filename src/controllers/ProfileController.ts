import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { PrismaClient } from "@prisma/client";
import AppError from "../utils/types/errors";
import { compare, hash } from "bcrypt";

const prisma = new PrismaClient();

export default class ProfileController {
  public updateUserDetails = asyncHandler(
    async (req: Request, res: Response) => {
      const payload = req.jwtPayload;
      const { avatar, banner, username, bio, handle } = req.body;

      const updatedUserDetails = await prisma.user.update({
        where: {
          id: payload.userId,
        },
        data: {
          avatar,
          banner,
          username,
          bio,
          handle,
        },
        select: {
          id: true,
          avatar: true,
          banner: true,
          username: true,
          bio: true,
          handle: true,
        },
      });

      res.status(200).json({
        message: "profile updated successfully.",
        data: updatedUserDetails,
      });
    }
  );

  public verifyPassword = asyncHandler(async (req: Request, res: Response) => {
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

    const foundUser = await prisma.user.findFirst({
      where: {
        id: payload.userId,
      },
    });

    if (!foundUser) {
      throw new AppError(404, "NotFound", "User not found.", true);
    }

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
      message: "Password verified.",
    });
  });

  public updatePassword = asyncHandler(async (req: Request, res: Response) => {
    const payload = req.jwtPayload;
    const { password } = req.body;

    if (!password) {
      throw new AppError(422, "Invalid format.", "No password provided.", true);
    }

    //hash the password
    const hashedPassword = await hash(password, 10);

    await prisma.user.update({
      where: {
        id: payload.userId,
      },
      data: {
        password: hashedPassword,
      },
    });

    res.status(200).json({
      message: "password updated successfully.",
    });
  });

  public updateEmail = asyncHandler(async (req: Request, res: Response) => {
    const payload = req.jwtPayload;
    const { email } = req.body;

    await prisma.user.update({
      where: {
        id: payload.userId,
      },
      data: {
        email,
      },
    });

    res.status(200).json({
      message: "email updated successfully.",
    });
  });

  public deleteAccount = asyncHandler(async (req: Request, res: Response) => {
    const payload = req.jwtPayload;

    await prisma.user.delete({
      where: {
        id: payload.userId,
      },
    });

    res.status(200).json({
      message: "account deleted successfully.",
    });
  });
}
