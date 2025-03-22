-- Create the GuildSettings table
CREATE TABLE GuildSettings (
    id VARCHAR PRIMARY KEY,  -- Guild ID (string)
    settings JSONB NOT NULL DEFAULT '{}'  -- Guild-specific settings as JSON
);
