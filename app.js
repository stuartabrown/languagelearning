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
const generateRouter = require("./routes/generate");

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

const session = require("express-session");
const flash = require("connect-flash");
// ... other requires ...
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
// ... other imports ...
const User = require("./models/User");

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key", // Use a strong secret key from environment variables
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" }, // Set cookie to secure in production
  })
);

// ... rest of your app.js code ...
app.use(flash()); // Add this line to use connect-flash

// Passport.js middleware (must be after mounting the usersRouter)
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(
    { usernameField: "username" },
    async (username, password, done) => {
      try {
        const user = await User.findOne({ username });
        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return done(null, false, { message: "Incorrect password." });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});
app.use((req, res, next) => {
  res.locals.user = req.user; // Make user available in res.locals
  res.locals.messages = req.flash(); // Make flash messages available
  next();
});
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
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));
const usersRouter = require("./routes/users");
app.use("/users", usersRouter); // Mount the users router at /users

// --- Routes ---
app.use("/", indexRouter);
app.use("/generate", generateRouter); // Mount the generate router at /generate

// ... other middleware ...
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
