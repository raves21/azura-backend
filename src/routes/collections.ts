import express from "express";
import CollectionsController from "../controllers/CollectionsController";

const router = express.Router();
const collectionsController = new CollectionsController();

router
  //get
  .get("/user/me", collectionsController.getCurrentUserCollections)
  .get("/user/:id", collectionsController.getUserCollections)
  .get("/:id", collectionsController.getCollectionInfo)
  .get(
    "/:collectionId/collection-items/:id",
    collectionsController.getCollectionItemInfo
  )
  .get(
    "/check-media-existence/:mediaId",
    collectionsController.checkMediaExistenceInCollections
  )

  //post
  .post("/", collectionsController.createCollection)
  .post("/:id/collection-items", collectionsController.addCollectionItem)

  //put
  .put("/:id", collectionsController.updateCollection)

  //delete (can delete one collection)
  .delete("/:id", collectionsController.deleteCollection)
  //delete (can delete multiple collectionItems)
  .delete("/:id/collection-items", collectionsController.deleteCollectionItems);

export default router;
