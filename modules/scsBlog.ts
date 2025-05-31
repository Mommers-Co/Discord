import fetch from 'node-fetch';
import fs from 'fs';
import Logger from '../core/logger';

// Main function to check for new blog posts
export default async function checkForNews() {
    try {
        Logger.info('Fetching SCS Blog feed'); // Log the event of fetching the blog feed

        // Fetch the RSS feed
        const feed = await fetch('https://blog.scssoft.com/feeds/posts/default')
            .then(response => response.text())
            .then(text => new (require('rss-parser'))().parseString(text));

        const latestPost = feed.items[0]; // Get the most recent post
        const lastSentPost = await getLastSentPost(); // Get the last sent post link

        // Check if the latest post has already been sent
        if (lastSentPost !== latestPost.link) {
            Logger.info(`New post found: ${latestPost.title}`); // Log when a new post is found

            // Prepare the embed to send via webhook
            const messageEmbed = {
                embeds: [{
                    title: latestPost.title,
                    url: latestPost.link,
                    timestamp: new Date(latestPost.isoDate),
                    footer: {
                        text: 'SCS Software Blog',
                    }
                }]
            };

            // Get the webhook URL from the config
            const webhookURL = config.discord.MCOLOGGuild.SCSNews;
            
            // Send the message to the Discord webhook
            await sendWebhookMessage(webhookURL, messageEmbed);
            Logger.info(`Post sent to Discord: ${latestPost.title}`); // Log the post being sent

            // Save the latest post's link to avoid resending it
            await saveLastSentPost(latestPost.link);
            Logger.info('Saved latest post link'); // Log that the post has been saved
        } else {
            Logger.info('No new post found, already sent the latest post'); // Log when there are no new posts
        }
    } catch (error) {
        Logger.error(`Error fetching the RSS feed: ${error.message}`); // Log errors
        console.error('Error fetching the RSS feed:', error);
    }
}

// Send message to the webhook
async function sendWebhookMessage(webhookURL: string, payload: object) {
    try {
        const response = await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Failed to send webhook message: ${response.statusText}`);
        }
        Logger.info('Message sent successfully'); // Log successful message sending
    } catch (error) {
        Logger.error(`Error sending webhook message: ${error.message}`); // Log webhook errors
        console.error('Error sending webhook message:', error);
    }
}

// Get the last sent post link
async function getLastSentPost(): Promise<string> {
    Logger.info('Retrieving last sent post'); // Log the retrieval of the last post
    try {
        // Check if the file exists
        await fs.promises.access('lastSentPost.json');
        
        // Read the last sent post link from storage (file or database)
        const data = await fs.promises.readFile('lastSentPost.json', 'utf-8');
        return JSON.parse(data).lastPostLink;
    } catch (error) {
        if (error.code === 'ENOENT') {
            Logger.info('No previous post found, starting fresh'); // Log if the file doesn't exist
            return ''; // Return default value if the file doesn't exist
        } else {
            Logger.error(`Error retrieving last sent post: ${error.message}`);
            throw error;
        }
    }
}

// Save the last sent post link to file
async function saveLastSentPost(link: string): Promise<void> {
    Logger.info('Saving last sent post'); // Log the saving of the last post
    try {
        const data = { lastPostLink: link };
        await fs.promises.writeFile('lastSentPost.json', JSON.stringify(data, null, 2));
        Logger.info('Last sent post saved successfully'); // Log success after saving
    } catch (error) {
        Logger.error(`Error saving last sent post: ${error.message}`);
        throw error;
    }
}
