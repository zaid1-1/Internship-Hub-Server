import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const db = new pg.Client(process.env.DATABASE_URL);

db.on("error", (err) => console.error(err));

export default db;