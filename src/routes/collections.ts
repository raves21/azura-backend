import express from "express";
import CollectionsController from "../controllers/CollectionsController";

const router = express.Router();
const collectionsController = new CollectionsController();

router
  //get
  .get("/user/me", collectionsController.getCurrentUserCollections)
  .get("/user/:handle", collectionsController.getUserCollections)
  .get(
    "/check-media-existence",
    collectionsController.checkMediaExistenceInCollections
  )
  .get("/:id", collectionsController.getCollectionInfo)
  .get(
    "/:collectionId/collection-items",
    collectionsController.getCollectionCollectionItems
  )
  .get(
    "/:collectionId/collection-items/:id",
    collectionsController.getCollectionItemInfo
  )
  .get(
    "/:id/check-media-existence",
    collectionsController.checkMediaExistenceInCollection
  )

  //post
  .post("/", collectionsController.createCollection)
  .post("/:id/collection-items", collectionsController.addCollectionItem)
  //delete MANY collection items by providing array of ids
  .post(
    "/:id/delete-collection-items",
    collectionsController.deleteCollectionItems
  )

  //put
  .put("/:id", collectionsController.updateCollection)

  //delete (can delete one collection)
  .delete("/:id", collectionsController.deleteCollection)
  //delete ONE collection item using the media id
  .delete("/:id/collection-items", collectionsController.deleteCollectionItem);

export default router;
