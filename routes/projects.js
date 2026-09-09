import makeSubResourceRouter from "./subResourceRouter.js";

// All CRUD routes come from the shared factory in subResourceRouter.js.
export default makeSubResourceRouter("projects", [
  "name",
  "description",
  "technologies",
  "github_url",
  "demo_url",
]);
