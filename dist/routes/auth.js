"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const AuthController_1 = __importDefault(require("../controllers/AuthController"));
const router = express_1.default.Router();
const authController = new AuthController_1.default();
router.get("/", (req, res) => {
    res.json({
        message: "bruh",
    });
});
router.post("/login", authController.login);
exports.default = router;
