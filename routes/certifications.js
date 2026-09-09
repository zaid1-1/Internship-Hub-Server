import makeSubResourceRouter from "./subResourceRouter.js";

// All CRUD routes come from the shared factory in subResourceRouter.js.
export default makeSubResourceRouter("certifications", [
  "name",
  "issuing_organization",
  "date",
  "credential_id",
  "credential_url",
]);
