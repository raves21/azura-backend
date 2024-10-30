import express from "express";
import SearchController from "../controllers/SearchController";

const router = express.Router();
const searchController = new SearchController();

router
  .get("/posts", searchController.searchPosts)
  .get("/users", searchController.searchUsers)
  .get("/collections", searchController.searchCollections);

export default router;
