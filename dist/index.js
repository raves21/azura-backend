"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const port = 8080;
app.get("/", (req, res) => {
    res.send("hello world");
});
app.get("/test", (req, res) => {
    res.send("teszt");
});
app.get("/bruh", (req, res) => {
    res.send("BRUHH");
});
app.listen(port, () => {
    console.log(`app now running on port ${port}`);
});
