const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};:'",.<>?\/\\|`~])[a-zA-Z0-9!@#$%^&*()_\-+=\[\]{};:'",.<>?\/\\|`~]{8,}$/;

// Schemas with validation functions
const schemas = {
  register: {
    validate: (body) => {
      const errors = {};
      
      if (!body.username) 
      {
        errors.username = "Username is required";
      } else if (body.username.length < 3 || body.username.length > 30) 
      {
        errors.username = "Username must be 3-30 characters";
      } else if (!usernameRegex.test(body.username)) 
      {
        errors.username = "Username can only contain letters, numbers, and underscores";
      }

      const trimmedEmail = (body.email || "").trim();
      if (!trimmedEmail) {
        errors.email = "Email is required";
      } else if (!emailRegex.test(trimmedEmail)) {
        errors.email = "Invalid email address";
      }

      if (!body.password) 
      {
        errors.password = "Password is required";
      } else if (!passwordRegex.test(body.password)) 
      {
        errors.password = "Password must be at least 8 characters with uppercase, lowercase, number, and special character";
      }

      if (body.full_name && typeof body.full_name !== "string")
      {
        errors.full_name = "Full name must be a string";
      }

      return errors;
    }
  },

  login: {
    validate: (body) => {
      const errors = {};

      const trimmedEmail = (body.email || "").trim();
      if (!trimmedEmail) {
        errors.email = "Email is required";
      } else if (!emailRegex.test(trimmedEmail)) 
      {
        errors.email = "Invalid email address";
      }

      if (!body.password) 
      {
        errors.password = "Password is required";
      }

      return errors;
    }
  },

  updateProfile: {
    validate: (body) => {
      const errors = {};

      if (body.full_name !== undefined && body.full_name !== null) {
        if (typeof body.full_name !== "string") {
          errors.full_name = "Full name must be a string";
        } else if (body.full_name.trim().length === 0) {
          errors.full_name = "Full name cannot be empty";
        } else if (body.full_name.length > 100) {
          errors.full_name = "Full name must be 100 characters or less";
        }
      }

      if (body.bio !== undefined && body.bio !== null) {
        if (typeof body.bio !== "string") {
          errors.bio = "Bio must be a string";
        } else if (body.bio.trim().length === 0) {
          errors.bio = "Bio cannot be empty";
        } else {
          const wordCount = body.bio.trim().split(/\s+/).length;
          if (wordCount > 50) {
            errors.bio = "Bio must be 50 words or less";
          }
        }
      }

      if (body.avatar !== undefined && body.avatar !== null) {
        if (typeof body.avatar !== "string") {
          errors.avatar = "Avatar must be a string";
        } else if (body.avatar.length > 5242880) {
          errors.avatar = "Avatar is too large. Maximum 5 MB.";
        }
      }

      return errors;
    }
  },

  addFriend: {
    validate: (body) => {
      const errors = {};

      if (!body.friend_id) {
        errors.friend_id = "Friend ID is required";
      } else if (typeof body.friend_id !== "string" || body.friend_id.trim().length === 0) {
        errors.friend_id = "Friend ID must be a non-empty string";
      }

      return errors;
    }
  },

  acceptFriend: {
    validate: (body) => {
      const errors = {};

      if (!body.request_id) {
        errors.request_id = "Request ID is required";
      } else if (typeof body.request_id !== "string" || body.request_id.trim().length === 0) {
        errors.request_id = "Request ID must be a non-empty string";
      }

      return errors;
    }
  }
};

// Middleware that actually validates
const validate = (schema) => {
  return (req, res, next) => {
    if (!schema || !schema.validate) {
      return next();
    }

    const errors = schema.validate(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    next();
  };
};

module.exports = {
  validate,
  schemas,
};
