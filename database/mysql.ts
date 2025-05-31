import { Sequelize } from "sequelize";
import fs from "fs";
import Logger from "../core/logger";

const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));

export const sequelizeMySQL = new Sequelize(
    config.database.name,
    config.database.user,
    config.database.password,
    {
        host: config.database.host,
        dialect: "mysql",
        logging: (msg) => Logger.info(msg),
    }
);

export const connectMySQL = async () => {
    if (config.database.type !== "mysql") return;

    try {
        await sequelizeMySQL.authenticate();
        Logger.info("Connected to MySQL database");
    } catch (error) {
        Logger.error(`MySQL Connection Error: ${error}`);
    }
};
