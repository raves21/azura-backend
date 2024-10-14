import express from "express"

const app = express();
const port = 8080;

app.use(express.json())

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
