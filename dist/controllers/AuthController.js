"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class AuthController {
    login(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { email, password } = req.body;
            if (!email || !password)
                res.status(400).json({
                    message: "Invalid. Please provide all needed credentials.",
                });
            const foundUser = yield prisma.user.findFirst({
                where: {
                    email,
                },
            });
            if (!foundUser)
                res.status(401).json({
                    message: "Unauthorized.",
                });
            //evaluate password
            const matchedPassword = yield bcrypt_1.default.compare(password, foundUser.password);
            if (matchedPassword) {
                //create JWT
                res.status(200).json({
                    message: `You are now logged in as ${foundUser === null || foundUser === void 0 ? void 0 : foundUser.username}`,
                });
            }
            else {
                res.status(403).json({
                    message: "Invalid credentials.",
                });
            }
        });
    }
}
exports.default = AuthController;
