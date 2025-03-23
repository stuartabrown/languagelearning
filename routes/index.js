// routes/index.js (Route Handlers)
const express = require("express");
const router = express.Router();
const Content = require("../models/Content");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Language options for the dropdown
const languageOptions = ["English", "Italian", "French"];

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", {
    title: "Language Learning Content Generator",
    languageOptions: languageOptions,
  });
});

// routes/index.js
// ... other imports ...

router.get("/register", (req, res) => {
  res.render("register");
});

router.get("/login", (req, res) => {
  res.render("login");
});

router.get("/:username", (req, res) => {
  const username = req.params.username;
  if (!req.user || req.user.username !== username) {
    // Prevent unauthorized access to other users' pages
    return res.redirect("/users/login");
  }
  res.render("user", { username });
}); // ... rest of your routes ...

router.get("/:username/generate", (req, res) => {
  const username = req.params.username;

  // Ensure the user is logged in and the username matches
  if (!req.user || req.user.username !== username) {
    return res.redirect("/users/login"); // Redirect to login if unauthorized
  }

  res.render("generate", { username });
}); /* POST generate content request */
router.post("/generate", async function (req, res, next) {
  const { language, prompt } = req.body;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-002",
    });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Store the request and response in the database
    const newContent = new Content({
      language,
      prompt,
      response: responseText,
    });
    await newContent.save();

    res.render("response", {
      title: "Generated Content",
      language: language,
      prompt: prompt,
      response: responseText,
    });
  } catch (error) {
    console.error("Error generating content:", error);
    next(error); // Pass error to error handler
  }
});

router.get("/history", async (req, res, next) => {
  try {
    const contentHistory = await Content.find({}).sort({ timestamp: -1 });
    res.render("history", {
      title: "Content History",
      history: contentHistory,
    });
  } catch (error) {
    console.error("Error getting content history:", error);
    next(error); // Pass error to error handler
  }
});

module.exports = router;
