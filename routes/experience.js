import makeSubResourceRouter from "./subResourceRouter.js";

// All CRUD routes come from the shared factory in subResourceRouter.js.
export default makeSubResourceRouter("experience", [
  "title",
  "organization",
  "start_date",
  "end_date",
  "description",
]);
