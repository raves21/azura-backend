export const ENTITY_OWNER_SELECT = {
  select: {
    id: true,
    username: true,
    handle: true,
    avatar: true,
  },
};

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
      owner: ENTITY_OWNER_SELECT,
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
  owner: ENTITY_OWNER_SELECT,
  _count: {
    select: {
      comments: true,
      likes: true,
    },
  },
});

export const CREATE_POST_SELECT = {
  id: true,
};
