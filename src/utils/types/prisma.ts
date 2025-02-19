import { NotificationType, Privacy } from "@prisma/client";
import { Response } from "express";

export type CheckResourcePrivacyAndUserRelationshipArgs = {
  currentUserId: string;
  ownerId: string;
  privacy: Privacy;
  successData: Record<string, any>;
  res: Response;
};

export type UpsertNotificationArgs = {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string | null;
};

type FoundUser = {
  id: string;
  username: string;
  password: string;
  email: string;
  handle: string;
  avatar: string | null;
  createdAt: Date;
  userSessions: {
    createdAt: Date;
    sessionId: string;
    userId: string;
    refreshTokenExpiresAt: Date;
    deviceName: string;
  }[];
};

export type DeleteExpiredSessionsAndLoginArgs = {
  password: string;
  foundUser: FoundUser;
  currentDate: Date;
  res: Response;
};
