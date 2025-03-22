import { Sequelize } from "sequelize";
import fs from "fs";
import Logger from "../core/logger";

const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));

export const sequelizePostgres = new Sequelize(
    config.database.name,
    config.database.user,
    config.database.password,
    {
        host: config.database.host,
        dialect: "postgres",
        logging: (msg) => Logger.info(msg),
    }
);

export const connectPostgres = async () => {
    if (config.database.type !== "postgres") return;

    try {
        await sequelizePostgres.authenticate();
        Logger.info("Connected to PostgreSQL database");
    } catch (error) {
        Logger.error(`PostgreSQL Connection Error: ${error}`);
    }
};
