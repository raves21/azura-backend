import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { asyncHandler } from "../middleware/asyncHandler";
import { createTransport } from "nodemailer";
import { compare, hash } from "bcrypt";
import AppError from "../utils/types/errors";

const prisma = new PrismaClient();
const transporter = createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.OTC_EMAIL,
    pass: process.env.OTC_PASSWORD,
  },
});

const getExpirationTime = (): Date => {
  const now = new Date();
  return new Date(now.getTime() + 60 * 60 * 1000); // current time + 1 hour in milliseconds
};

export default class OTCController {
  public sendOTC = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    const otc = `${Math.floor(100000 + Math.random() * 900000)}`;

    //find record in otc table if exists
    const foundOTCRecord = await prisma.oTC.findFirst({
      where: {
        email,
      },
    });

    if (foundOTCRecord) {
      //delete record of the user in otc table (if it exists)
      await prisma.oTC.deleteMany({
        where: {
          id: foundOTCRecord.id,
        },
      });
    }

    //send the email
    await transporter.sendMail({
      from: process.env.OTC_EMAIL,
      to: email,
      subject: "OTC from AZURA",
      html: `<p>Here is your verification code: <strong>${otc}</strong></p><br><p>This code will expire in 1 hour.</p>`,
    });

    //*only store record in the db if the sendMail succeeds.
    //encrypt the otc before storing in the db
    const hashedOTC = await hash(otc, 10);

    //create new record in the otc table for the user
    await prisma.oTC.create({
      data: {
        email,
        otc: hashedOTC,
        expiresAt: getExpirationTime(),
      },
    });
    res.status(200).json("otc sent.");
    return;
  });

  public verifyOTC = asyncHandler(async (req: Request, res: Response) => {
    const { email, otc } = req.body;

    if (!otc || !email) {
      throw new AppError(
        422,
        "Invalid Format.",
        "Please provide all credentials.",
        true
      );
    }

    //find the otc record using the email
    const foundOTCRecord = await prisma.oTC.findFirst({
      where: {
        email,
      },
    });

    if (!foundOTCRecord) {
      throw new AppError(
        404,
        "NotFound",
        "OTC with given email not found.",
        true
      );
    }

    //verify if the otc is expired
    if (foundOTCRecord.expiresAt < new Date()) {
      //if code is expired, delete it in the db
      await prisma.oTC.delete({
        where: {
          id: foundOTCRecord.id,
        },
      });
      throw new AppError(
        410,
        "OTC Expired.",
        "The code you provided is expired.",
        true
      );
    }

    //check if given OTC and the OTC from the database matches
    const matchedOTC = await compare(otc, foundOTCRecord.otc);

    if (!matchedOTC) {
      throw new AppError(
        400,
        "Invalid OTC.",
        "The verification code is incorrect.",
        true
      );
    }

    //if OTC matches, delete the record in db
    await prisma.oTC.delete({
      where: {
        id: foundOTCRecord.id,
      },
    });

    res.status(200).json({
      message: "success. the otc is correct.",
    });
  });
}