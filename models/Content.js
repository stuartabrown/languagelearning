// models/Content.js (Mongoose Model)
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ContentSchema = new Schema({
  language: { type: String, required: true },
  prompt: { type: String, required: true },
  response: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  user: {
    id: { type: Schema.Types.ObjectId, required: true, ref: "User" }, // Reference to the User model
    username: { type: String, required: true }, // Store the username
    email: { type: String }, // Optionally store the email
  },
  audioFile: { type: String }, // Reference to the audio file
  theme: [{ type: String }], // Array of strings for themes
  type: [{ type: String }], // Array of strings for types
});

module.exports = mongoose.model("Content", ContentSchema);
