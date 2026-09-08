import makeLookupRouter from "./lookupRouter.js";

// All 5 CRUD routes come from the shared factory in lookupRouter.js.
// Note: this table also has a "category" column that the factory
// doesn't touch - fine for now, can extend the POST/PUT bodies later
// if the Admin Platform Data screen needs to edit category too.
export default makeLookupRouter("skills");