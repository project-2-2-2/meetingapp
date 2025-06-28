// signaling-server/server.js

require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb'); // Import MongoClient

const app = express();
const server = http.createServer(app);

// Configure Socket.IO server with CORS
const io = new Server(server, {
    cors: {
        origin: "*", // WARNING: Restrict this to your frontend's domain(s) in production!
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = "interview_sessions_db";
const COLLECTION_NAME = "room_sessions";

let db; // MongoDB database instance

// --- MongoDB Connection ---
async function connectToMongoDB() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log("Connected to MongoDB successfully!");
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);
        process.exit(1); // Exit if database connection fails
    }
}

// Map to keep track of active rooms and their participants in memory
// This is for quick lookup and efficient updates, complementing DB persistence.
const activeRooms = {}; // Structure: {roomId: { [socketId]: {peerId, role, joinTime}, ... }}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle 'join-room' event
    // The client sends roomId, candidateId, jobId, and userRole
    socket.on('join-room', async (roomId, peerId, candidateId, jobId, userRole) => {
        socket.join(roomId); // Make the socket join a specific room

        if (!activeRooms[roomId]) {
            activeRooms[roomId] = {};
            // If first user in room, create a new session in MongoDB
            if (db) {
                try {
                    await db.collection(COLLECTION_NAME).insertOne({
                        roomId: roomId,
                        candidateId: candidateId,
                        jobId: jobId,
                        startTime: new Date(),
                        participants: [{ socketId: socket.id, peerId: peerId, role: userRole, joinTime: new Date() }],
                        endTime: null // Will be updated on last participant leave
                    });
                    console.log(`New room session created in DB for room: ${roomId}`);
                } catch (e) {
                    console.error(`MongoDB error creating room session: ${e}`);
                }
            }
        } else {
            // If room exists, update participants list in MongoDB
            if (db) {
                try {
                    await db.collection(COLLECTION_NAME).updateOne(
                        { roomId: roomId, endTime: null }, // Find active session
                        { 
                            $push: { participants: { socketId: socket.id, peerId: peerId, role: userRole, joinTime: new Date() } },
                            $set: { endTime: null } // Ensure endTime is null if someone rejoins
                        }
                    );
                    console.log(`Participant added to existing session in DB for room: ${roomId}`);
                } catch (e) {
                    console.error(`MongoDB error updating room session: ${e}`);
                }
            }
        }
        
        activeRooms[roomId][socket.id] = { peerId, role: userRole, joinTime: new Date() };

        console.log(`User ${socket.id} (Peer: ${peerId}, Role: ${userRole}) joined room: ${roomId}`);

        // Notify other users in the room about the new participant
        socket.to(roomId).emit('user-joined', socket.id);

        // Also, if there are existing users in the room, send their IDs to the new user
        const existingUsers = Object.keys(activeRooms[roomId]).filter(id => id !== socket.id);
        if (existingUsers.length > 0) {
            socket.emit('existing-users', existingUsers);
            console.log(`Sent existing users (${existingUsers.length}) to new user ${socket.id}`);
        }
    });

    // Handle 'signal' event (WebRTC signaling data: offers, answers, ICE candidates)
    socket.on('signal', (data) => {
        io.to(data.to).emit('signal', { from: socket.id, signal: data.signal });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        console.log(`User disconnected: ${socket.id}`);
        // Find which room the user was in and remove them
        for (const roomId in activeRooms) {
            if (activeRooms[roomId][socket.id]) {
                const disconnectedParticipant = activeRooms[roomId][socket.id];
                delete activeRooms[roomId][socket.id]; // Remove from in-memory map

                // Notify others in the room that this user has left
                socket.to(roomId).emit('user-left', socket.id);
                console.log(`User ${socket.id} left room: ${roomId}`);

                // Update MongoDB session
                if (db) {
                    try {
                        const roomParticipantsCount = Object.keys(activeRooms[roomId]).length;
                        if (roomParticipantsCount === 0) {
                            // If last user, update endTime for the session in DB
                            await db.collection(COLLECTION_NAME).updateOne(
                                { roomId: roomId, endTime: null }, // Find active session
                                { $set: { endTime: new Date() } }
                            );
                            console.log(`Room session for ${roomId} marked as ended in DB.`);
                            delete activeRooms[roomId]; // Clean up in-memory empty room
                        } else {
                            // Otherwise, just update the participant's leave time within the array
                            await db.collection(COLLECTION_NAME).updateOne(
                                { roomId: roomId, "participants.socketId": socket.id, endTime: null },
                                { $set: { "participants.$.leaveTime": new Date() } } // Update specific participant
                            );
                            console.log(`Participant ${socket.id} leave time updated in DB for room: ${roomId}.`);
                        }
                    } catch (e) {
                        console.error(`MongoDB error on disconnect: ${e}`);
                    }
                }
                break; // User can only be in one room in this simple setup
            }
        }
    });
});

// Start the server after connecting to MongoDB
connectToMongoDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Signaling server listening on port ${PORT}`);
    });
});

