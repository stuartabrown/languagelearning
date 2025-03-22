// models/Content.js (Mongoose Model)
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ContentSchema = new Schema({
  language: { type: String, required: true },
  prompt: { type: String, required: true },
  response: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Content", ContentSchema);
