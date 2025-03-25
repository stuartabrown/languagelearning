// routes/index.js (Route Handlers)
const express = require("express");
const router = express.Router();
const Content = require("../models/Content");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const stream = require("stream");
const fs = require("fs");
const path = require("path");
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

  const { language, theme, type, prompt } = req.body;

  try {
    console.log("Generating content with Google Gemini API...");
    console.log("Prompt:", prompt);

    // Interact with Google Gemini API
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-002" });
    const result = await model.generateContent(prompt);

    // Check if the response is valid
    if (!result || !result.response) {
      console.error("No response received from Google Gemini API.");
      return res.status(500).send("Failed to generate content. Please try again.");
    }

    const responseText = result.response.text(); // Get the actual response text
    console.log("Response from Google Gemini API:", responseText);

    // Debugging: Log the response text
    console.log("Response Text:", responseText);

    // Extract content within <marked>, <native>, and <learning> tags
    const markedMatch = responseText.match(/<marked>([\s\S]*?)<\/marked>/);
    const nativeMatch = responseText.match(/<native>([\s\S]*?)<\/native>/);
    const learningMatch = responseText.match(/<learning>([\s\S]*?)<\/learning>/);

    // Debugging: Log the extracted matches
    console.log("Extracted Marked Match:", markedMatch);
    console.log("Extracted Native Match:", nativeMatch);
    console.log("Extracted Learning Match:", learningMatch);

    // Extract the content or set to null if not found
    const marked = markedMatch ? markedMatch[1].trim() : null;
    const native = nativeMatch ? nativeMatch[1].trim() : null;
    const learning = learningMatch ? learningMatch[1].trim() : null;

    // Debugging: Log the extracted content
    console.log("Extracted Marked Content:", marked);
    console.log("Extracted Native Content:", native);
    console.log("Extracted Learning Content:", learning);

    // Store the request and response in the database, including user details
    const newContent = new Content({
      language,
      prompt,
      response: responseText, // Save the full response text
      theme: Array.isArray(theme) ? theme : [theme], // Ensure theme is an array
      type: Array.isArray(type) ? type : [type], // Ensure type is an array
      marked, // Save extracted marked content
      native, // Save extracted native content
      learning, // Save extracted learning content
      user: {
        id: req.user._id, // Store the user's ID
        username: req.user.username, // Store the username
        email: req.user.email || null, // Store the email (if available)
      },
    });

    const savedContent = await newContent.save();
    console.log("Content saved to the database:", savedContent);

    // Render the response page with the generated content
    res.render("response", {
      title: "Generated Content",
      username,
      prompt,
      response: responseText,
      contentId: savedContent._id, // Pass the content ID to the template
    });
  } catch (error) {
    console.error("Error generating content:", error);
    next(error); // Pass error to error handler
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

router.post("/:username/download-audio", async (req, res, next) => {
  const username = req.params.username;

  // Ensure the user is logged in and the username matches
  if (!req.user || req.user.username !== username) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { responseText, contentId } = req.body;

  if (!responseText || typeof responseText !== "string") {
    console.error("Invalid or missing responseText:", responseText);
    return res.status(400).json({ error: "Invalid or missing responseText" });
  }

  if (!contentId || typeof contentId !== "string") {
    console.error("Invalid or missing contentId:", contentId);
    return res.status(400).json({ error: "Invalid or missing contentId" });
  }

  try {
    console.log("Sending to ElevenLabs API for download:", {
      text: responseText,
    });

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

    // Use the content's ID as the filename
    const filename = `${contentId}.mp3`;
    const filepath = path.join(__dirname, "../public/audio", filename);

    // Save the audio stream to a file
    const writer = fs.createWriteStream(filepath);
    elevenLabsResponse.data.pipe(writer);

    writer.on("finish", async () => {
      console.log(`Audio file saved: ${filepath}`);

      // Update the content document in the database with the audio file reference
      await Content.findByIdAndUpdate(contentId, { audioFile: filename });

      res.json({ downloadUrl: `/audio/${filename}` });
    });

    writer.on("error", (error) => {
      console.error("Error saving audio file:", error);
      res.status(500).json({ error: "Failed to save audio file" });
    });
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

router.get("/:username/refresh", async (req, res, next) => {
  const username = req.params.username;

  // Ensure the user is logged in and the username matches
  if (!req.user || req.user.username !== username) {
    return res.status(403).send("Unauthorized");
  }

  try {
    // Fetch content created by the specified username
    const contentHistory = await Content.find({
      "user.username": username,
    }).sort({ timestamp: -1 });

    // Check if the audio file exists for each content item
    const historyWithAudio = contentHistory.map((content) => {
      const audioFilePath = path.join(
        __dirname,
        "../public/audio",
        `${content._id}.mp3`
      );
      const audioExists = fs.existsSync(audioFilePath);
      return {
        ...content.toObject(),
        audioExists, // Add audio existence flag
      };
    });

    console.log("History with audio:", historyWithAudio); // Debugging log

    // Render only the table body as HTML
    res.render("partials/history-table-body", { history: historyWithAudio });
  } catch (error) {
    console.error("Error refreshing content history:", error);
    next(error); // Pass error to error handler
  }
});

// Dynamic route for username
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

    // Check if the audio file exists for each content item
    const historyWithAudio = contentHistory.map((content) => {
      const audioFilePath = path.join(
        __dirname,
        "../public/audio",
        `${content._id}.mp3`
      );
      const audioExists = fs.existsSync(audioFilePath);
      return {
        ...content.toObject(),
        audioExists, // Add audio existence flag
      };
    });

    // Render the history page with the filtered content
    res.render("history", {
      title: `${username}'s Content History`,
      history: historyWithAudio,
    });
  } catch (error) {
    console.error("Error getting content history:", error);
    next(error); // Pass error to error handler
  }
});

// GET /:username/upload - Render the upload form
router.get("/:username/upload", (req, res) => {
  const username = req.params.username;

  // Ensure the user is logged in and the username matches
  if (!req.user || req.user.username !== username) {
    return res.redirect("/users/login"); // Redirect to login if unauthorized
  }

  // Render the upload form with language options
  res.render("upload", {
    username,
    languageOptions: ["English", "Italian", "French"], // Add more languages as needed
  });
});

router.get("/:username/:contentId", async (req, res, next) => {
  const { username, contentId } = req.params;

  try {
    const content = await Content.findById(contentId);

    const audioFilePath = path.join(
      __dirname,
      "../public/audio",
      `${content._id}.mp3`
    );
    const audioExists = fs.existsSync(audioFilePath);

    // Process content.marked to replace **word** with dropdowns
    let processedMarked = content.marked;
    if (content.marked) {
      processedMarked = content.marked.replace(/\*\*(.*?)\*\*/g, (match, word) => {
        return `
          <select class="form-select" style="width: auto; display: inline-block;">
            <option value="${word}">${word}</option>
            <option value="foo">foo</option>
          </select>
        `;
      });
    }

    res.render("content-details", {
      title: "Content Details",
      username,
      content,
      audioExists,
      processedMarked, // Pass the processed marked content
    });
  } catch (error) {
    console.error("Error fetching content details:", error);
    next(error);
  }
});

// POST /:username/upload - Handle form submission and save user-provided content
router.post("/:username/upload", async (req, res, next) => {
  const username = req.params.username;

  // Ensure the user is logged in and the username matches
  if (!req.user || req.user.username !== username) {
    return res.redirect("/users/login"); // Redirect to login if unauthorized
  }

  const { language, theme, type, prompt, response } = req.body;

  try {
    // Save the user-provided content to the database
    const newContent = new Content({
      language,
      prompt,
      response, // Save the user-provided response
      theme: Array.isArray(theme) ? theme : [theme], // Ensure theme is an array
      type: Array.isArray(type) ? type : [type], // Ensure type is an array
      user: {
        id: req.user._id, // Store the user's ID
        username: req.user.username, // Store the username
        email: req.user.email || null, // Store the email (if available)
      },
    });

    const savedContent = await newContent.save();
    console.log("User-provided content saved to the database:", savedContent);

    // Redirect to the user's content page
    res.redirect(`/${username}`);
  } catch (error) {
    console.error("Error saving user-provided content:", error);
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

router.post("/submit-marked", (req, res) => {
  const { markedContent } = req.body;
  console.log("Submitted Marked Content:", markedContent);
  res.redirect("back"); // Redirect back to the previous page
});

module.exports = router;
