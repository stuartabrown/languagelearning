// app.js (Main Express App)

const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load environment variables (including API key)
require("dotenv").config();

const indexRouter = require("./routes/index");

const app = express();

// --- Database Setup ---
// Use an environment variable for the database name (default to 'languageLearning')
const dbName = process.env.MONGODB_DATABASE || "languageLearning";

// Construct the MongoDB connection string
let mongoDB = process.env.MONGODB_URI; // get the database uri
if (!mongoDB) {
  mongoDB = `mongodb://127.0.0.1:27017/${dbName}`;
} else {
  // Ensure the URI ends with a slash for database name appending
  if (!mongoDB.endsWith("/")) {
    mongoDB += "/";
  }
  mongoDB += dbName;
}

// Connect to MongoDB
mongoose.connect(mongoDB, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log(`Connected to MongoDB database: ${dbName}`);
});

// --- Gemini API Setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // Get API key from env

// --- View Engine Setup ---
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// --- Routes ---
app.use("/", indexRouter);

// --- Error Handling ---
app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.render("error");
});

// --- App Export ---
module.exports = app;
