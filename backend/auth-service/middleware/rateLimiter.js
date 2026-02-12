const passThrough = () => (req, res, next) => next();

const authLimiter = passThrough();
const registerLimiter = passThrough();
const passwordResetLimiter = passThrough();

module.exports = {
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
};
