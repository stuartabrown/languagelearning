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

router.get("/:username", async (req, res, next) => {
  const username = req.params.username;

  // Ensure the user is logged in and the username matches
  if (!req.user || req.user.username !== username) {
    return res.redirect("/users/login"); // Redirect to login if unauthorized
  }

  try {
    // Fetch content created by the specified username
    const contentHistory = await Content.find({ "user.username": username }).sort({ timestamp: -1 });

    // Render the history page with the filtered content
    res.render("history", {
      title: `${username}'s Content History`,
      history: contentHistory,
    });
  } catch (error) {
    console.error("Error getting content history:", error);
    next(error); // Pass error to error handler
  }
});

// GET /:username/generate - Render the generate form
router.get("/:username/generate", (req, res) => {
  const username = req.params.username;

  // Ensure the user is logged in and the username matches
  if (!req.user || req.user.username !== username) {
    return res.redirect("/users/login"); // Redirect to login if unauthorized
  }

  // Render the generate form with language options
  res.render("generate", {
    username,
    languageOptions: ["English", "Italian", "French"],
  });
});

// POST /:username/generate - Handle form submission and interact with Google Gemini API
router.post("/:username/generate", async (req, res, next) => {
  const username = req.params.username;

  // Ensure the user is logged in and the username matches
  if (!req.user || req.user.username !== username) {
    return res.redirect("/users/login"); // Redirect to login if unauthorized
  }

  const { language, prompt } = req.body;

  try {
    // Interact with Google Gemini API
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-002" });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Store the request and response in the database, including user details
    const newContent = new Content({
      language,
      prompt,
      response: responseText,
      user: {
        id: req.user._id, // Store the user's ID
        username: req.user.username, // Store the username
        email: req.user.email || null, // Store the email (if available)
      },
    });
    await newContent.save();

    // Render the response page
    res.render("response", {
      title: "Generated Content",
      username,
      language,
      prompt,
      response: responseText,
    });
  } catch (error) {
    console.error("Error generating content:", error);
    next(error);
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
