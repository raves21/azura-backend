export const POSTS_INCLUDE = (currentUserId: string) => ({
  likes: {
    where: {
      userId: currentUserId,
    },
    select: {
      userId: true,
    },
  },
  media: true,
  collection: {
    select: {
      id: true,
      photo: true,
      name: true,
      description: true,
      owner: true,
      privacy: true,
      collectionItems: {
        take: 3,
        select: {
          media: {
            select: {
              title: true,
              year: true,
              type: true,
              posterImage: true,
              coverImage: true,
            },
          },
        },
      },
    },
  },
  owner: {
    select: {
      id: true,
      avatar: true,
      username: true,
      handle: true,
    },
  },
  _count: {
    select: {
      comments: true,
      likes: true,
    },
  },
});
