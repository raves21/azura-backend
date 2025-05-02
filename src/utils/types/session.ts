import { Request } from "express";

export type Session = {
  userId: string;
  sessionId: string;
  email: string;
  handle: string;
};

export type RequestWithSession = Request & {
  session: Session;
};
