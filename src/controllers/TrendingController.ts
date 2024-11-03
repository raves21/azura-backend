import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export default class TrendingController {
  public getTrendingPosts = asyncHandler(
    async (req: Request, res: Response) => {
      const daysInterval = 7; //weekly trending
      const timeFilter = Prisma.sql`AND p."createdAt" >= NOW() - INTERVAL '${daysInterval} days'`;

      // Get trending hashtags
      const trendingHashtags = await prisma.$queryRaw<
        { hashtag: string; count: bigint }[]
      >`
            SELECT 
                LOWER(unnest(regexp_matches(content, '#[[:alnum:]_]+', 'g'))) AS hashtag, 
                COUNT(*) AS count
            FROM posts p
            WHERE privacy = 'PUBLIC'
            ${timeFilter}
            GROUP BY hashtag
            ORDER BY count DESC
            LIMIT 5
            `;

      // Get trending media
      const trendingMedia = await prisma.$queryRaw<
        { title: string; count: bigint }[]
      >`
            SELECT 
                m.title AS title, 
                COUNT(*) as count
            FROM posts p
            INNER JOIN media m ON p."mediaId" = m.id
            WHERE p.privacy = 'PUBLIC'
                AND p."mediaId" IS NOT NULL
            ${timeFilter}
            GROUP BY title
            ORDER BY count DESC
            LIMIT 5
            `;

      const combinedResult = [
        ...trendingHashtags.map((row) => ({
          type: "hashtag",
          content: row.hashtag,
          count: Number(row.count),
        })),
        ...trendingMedia.map((row) => ({
          type: "media",
          content: row.title,
          count: Number(row.count),
        })),
      ];

      const combinedResultSortedByCount = combinedResult.sort(
        (a, b) => b.count - a.count
      );

      res.status(200).json({
        message: "success",
        data: combinedResultSortedByCount,
      });
    }
  );
}
