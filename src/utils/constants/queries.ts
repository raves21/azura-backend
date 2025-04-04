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
      collectionItems: COLLECTION_PREVIEW_MEDIAS_INCLUDE,
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

export const COLLECTION_PREVIEW_MEDIAS_INCLUDE = {
  take: 4,
  select: {
    media: {
      select: {
        id: true,
        title: true,
        year: true,
        type: true,
        posterImage: true,
        coverImage: true,
        rating: true,
        description: true,
      },
    },
  },
};
