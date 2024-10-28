import { Request, Response, NextFunction } from "express";
import AppError from "../utils/types/errors";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

type ErrorResponse = {
  httpCode: number;
  message: string;
  name: string;
  stack?: string;
  errors?: Error;
};

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  //log the error
  console.error(error);

  //default error configuration
  let response: ErrorResponse = {
    httpCode: 500,
    name: error.name,
    message: "An error occured in the server.",
  };

  if (error instanceof AppError) {
    response.httpCode = error.httpCode;
    response.message = error.message;
  } else if (error instanceof PrismaClientKnownRequestError) {
    response.httpCode = 400;
    response.message = error.message;
    response.errors = error;
  } else if (error instanceof JsonWebTokenError) {
    response.httpCode = 401;
    response.message = "Your JWT is invalid.";
  } else if (error instanceof TokenExpiredError) {
    response.httpCode = 401;
    response.message = error.message;
  } else {
    response.message = error.message;
    response.name = error.name;
  }

  res.status(response.httpCode).json(response);
};
