import { Prisma } from "@prisma/client";
import { Request } from "express";

export function getPaginationParameters(req: Request) {
  const { page, perPage, ascending } = req.query;

  const order: Prisma.SortOrder = ascending == "true" ? "asc" : "desc";
  const _page = Number(page) || 1;
  const _perPage = Number(perPage) || 10;
  const skip = (_page - 1) * _perPage;

  return { order, _page, _perPage, skip };
}
