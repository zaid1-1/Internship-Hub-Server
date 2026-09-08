// Generalized version of the adminAuth.js pattern from class — restricts
// a route to one specific role (student / company / admin) instead of
// hardcoding "admin" every time.
// Usage: router.post("/", roleAuth("company"), handler)
export default function roleAuth(allowedRole) {
  return (req, res, next) => {
    const role = req.headers["x-role"];

    if (role !== allowedRole) {
      return res.status(403).json({ message: `${allowedRole} access only` });
    }

    req.userId = req.headers["x-user-id"];
    req.role = role;

    next();
  };
}