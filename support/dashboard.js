// /support/dashboard.js
const sdk = require('appwrite');
const config = require('../config.json'); // Load config.json from the directory

// Initialize Appwrite client
const client = new sdk.Client();
client
    .setEndpoint(coinfig.appwrite.endpoint)
    .setProject(config.appwrite.projectId);

const database = new sdk.Databases(client);

async function fetchTickets() {
    try {
        const response = await database.listDocuments('tickets');
        const tickets = response.documents;
        const tbody = document.getElementById('ticketsTable').getElementsByTagName('tbody')[0];

        tickets.forEach(ticket => {
            const row = tbody.insertRow();
            row.insertCell(0).innerText = ticket.$id;
            row.insertCell(1).innerText = ticket.userId;
            row.insertCell(2).innerText = ticket.content;
            row.insertCell(3).innerText = ticket.status;
            row.insertCell(4).innerText = new Date(ticket.createdAt).toLocaleString();
        });
    } catch (error) {
        console.error('Failed to fetch tickets:', error);
    }
}

fetchTickets();
