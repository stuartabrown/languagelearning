// routes/index.js (Route Handlers)
const express = require("express");
const router = express.Router();
const Content = require("../models/Content");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const stream = require("stream");
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
    const contentHistory = await Content.find({
      "user.username": username,
    }).sort({ timestamp: -1 });

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

    // Render the response page with the audio button
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

// Route to handle ElevenLabs API request
router.post("/:username/audio", async (req, res, next) => {
  const username = req.params.username;

  // Ensure the user is logged in and the username matches
  if (!req.user || req.user.username !== username) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { responseText } = req.body;

  if (!responseText || typeof responseText !== "string") {
    return res.status(400).json({ error: "Invalid or missing responseText" });
  }

  try {
    console.log("Sending to ElevenLabs API:", { text: responseText });

    // Replace with a valid voice ID from your ElevenLabs account
    const voiceId = "9BWtsMINqrJLrRacOk9x";

    const elevenLabsResponse = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        text: responseText,
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.85,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        responseType: "stream", // Get the audio as a stream
      }
    );

    console.log("ElevenLabs API response headers:", elevenLabsResponse.headers);

    // Pipe the audio stream back to the client
    res.setHeader("Content-Type", "audio/mpeg");
    elevenLabsResponse.data.pipe(res);
  } catch (error) {
    console.error(
      "Error with ElevenLabs API:",
      error.response?.data || error.message
    );
    res.status(500).json({
      error: "Failed to generate audio",
      details: error.response?.data || error.message,
    });
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

// Function to fetch and log available voices
async function fetchAvailableVoices() {
  try {
    const voicesResponse = await axios.get(
      "https://api.elevenlabs.io/v1/voices",
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
      }
    );
    console.log("Available voices:", voicesResponse.data);
  } catch (error) {
    console.error("Error fetching available voices:", error.message);
  }
}

// Call the function to fetch voices
fetchAvailableVoices();

module.exports = router;
