// Checks that the request has identifying headers (x-user-id, x-role).
// The frontend sends these on every authenticated request, taken from
// the logged-in user object stored in localStorage after login.
export default function requireAuth(req, res, next) {
  const userId = req.headers["x-user-id"];
  const role = req.headers["x-role"];

  if (!userId || !role) {
    return res.status(401).json({ message: "Not logged in" });
  }

  req.userId = userId;
  req.role = role;

  next();
}