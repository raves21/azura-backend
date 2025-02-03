import express from "express";
import { DiscoverPeopleController } from "../controllers/DiscoverPeopleController";

const router = express.Router();
const discoverPeopleController = new DiscoverPeopleController()

router.get("/", discoverPeopleController.getDiscoverPeople)

export default router