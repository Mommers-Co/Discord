import mongoose from "mongoose";
import fs from "fs";
import Logger from "../core/logger";

// Load the configuration
const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));

// MongoDB schema for GuildSettings
const GuildSettingsSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    settings: { type: Object, default: {} },
});

// Define the MongoDB model for GuildSettings
export const MongoGuildSettings = mongoose.model('GuildSettings', GuildSettingsSchema);

// Function to connect to MongoDB
export const connectMongoDB = async () => {
    if (config.database.type !== "mongo") return;

    try {
        // Connect to MongoDB using URI from config
        await mongoose.connect(config.database.uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        Logger.info("Connected to MongoDB");
    } catch (error) {
        Logger.error(`MongoDB Connection Error: ${error}`);
    }
};
