const express = require("express");
const router = express.Router();
const Content = require("../models/Content"); // Assuming you have a Content model
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Language options for the dropdown
const languageOptions = ["English", "Italian", "French"];

// updaed Middleware to check if user is authenticated
const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/users/login");
};

router.get("/", isLoggedIn, (req, res) => {
  res.render("generate", { languageOptions: languageOptions });
});

router.post("/", isLoggedIn, async (req, res, next) => {
  const { language, prompt } = req.body;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const newContent = new Content({
      language,
      prompt,
      response: responseText,
    });
    await newContent.save();

    res.render("response", { language, prompt, response: responseText });
  } catch (error) {
    console.error("Error generating content:", error);
    next(error);
  }
});

module.exports = router;
