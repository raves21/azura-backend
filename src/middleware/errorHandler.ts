import { Request, Response, NextFunction } from "express";
import AppError from "../utils/types/errors";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { ERROR_CODES_WITH_ERROR_NAME } from "../utils/constants/errorCodes";

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
    name: ERROR_CODES_WITH_ERROR_NAME[500],
    message: "An error occured in the server.",
  };

  if (error instanceof AppError) {
    response.httpCode = error.httpCode;
    response.message = error.message;
  } else if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      response.httpCode = 404;
      response.message = ERROR_CODES_WITH_ERROR_NAME[404];
    } else {
      response.httpCode = 400;
      response.message = "A database operation failed.";
    }
    response.errors = error;
  } else {
    response.message = error.message;
    response.name = error.name;
  }

  res.status(response.httpCode).json(response);
};
