const express = require("express");
const router = express.Router();
const User = require("../models/User");
const passport = require("passport"); // You'll need to set up Passport.js (see step 4)

// Registration Route
router.post("/register", async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const newUser = new User({ username, email, password });
    await newUser.save();
    res.redirect("/login"); // Redirect to login after successful registration
  } catch (error) {
    console.error("Registration error:", error);
    next(error); // Handle errors appropriately (e.g., display error messages)
  }
});

// routes/users.js
// ... other imports ...

// Registration Route
router.get("/register", (req, res) => {
  res.render("register");
});

// ... rest of your routes ...
// Login Page Route (GET)
router.get("/login", (req, res) => {
  res.render("login");
});

// Login POST Route (using Passport.js)
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/users/login",
    failureFlash: true,
  })
);

// Logout Route
router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

module.exports = router;
