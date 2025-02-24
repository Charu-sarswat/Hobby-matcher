const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { createServer } = require('http');
const { Server } = require('socket.io');
const User = require('./models/User');
const waitingUsers = new Map(); // Change to Map for better tracking
const waitingRoom = new Set(); // Add at the top with other declarations

// Load correct env file
dotenv.config({
    path: process.env.NODE_ENV === 'production'
        ? '.env.production'
        : '.env'
});

// Connect to database
connectDB();

const app = express();
const httpServer = createServer(app);

// Update CORS for both development and production
const allowedOrigins = [
    'http://localhost:5173',  // development
    'https://hobby-matcher-9-a0oh.onrender.com',  // you'll add this later
    'http://192.168.29.253:5173',
    'https://hobby-matcher-frontend-wapg.onrender.com',
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json());

// Basic route to test deployment
app.get('/', (req, res) => {
    res.json({ message: 'Hobby Matcher API is running' });
});

// Wake-up route
app.get('/api/wake-up', (req, res) => {
    res.json({ status: 'Server is awake' });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/user'));

const connectedUsers = new Map();

// Socket.io
const io = new Server(httpServer, {
    cors: {
        origin: 'https://hobby-matcher-frontend-wapg.onrender.com',
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Socket.io
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register-user', async (userId) => {
        try {
            // Update user's online status in database
            await User.findByIdAndUpdate(userId, { isOnline: true });

            // Broadcast online status to all clients
            io.emit('user-status-change', { userId, isOnline: true });

            socket.userId = userId;
        } catch (error) {
            console.error('Error updating online status:', error);
        }
    });

    socket.on('disconnect', async () => {
        if (socket.userId) {
            try {
                // Update user's online status in database
                await User.findByIdAndUpdate(socket.userId, { isOnline: false });

                // Broadcast offline status to all clients
                io.emit('user-status-change', { userId: socket.userId, isOnline: false });
            } catch (error) {
                console.error('Error updating offline status:', error);
            }
        }
        console.log('User disconnected:', socket.id);

        // Remove from waiting queue
        for (const [userId, user] of waitingUsers) {
            if (user.socketId === socket.id) {
                waitingUsers.delete(userId);
                console.log(`User ${userId} removed from queue due to disconnect`);
                break;
            }
        }

        // Remove from waiting room
        for (const user of waitingRoom) {
            if (user.socketId === socket.id) {
                waitingRoom.delete(user);
                console.log(`User removed from waiting room due to disconnect. Current size: ${waitingRoom.size}`);
                break;
            }
        }
    });

    // Handle WebRTC signaling
    socket.on('offer', ({ offer, roomId }) => {
        console.log('Relaying offer in room:', roomId);
        socket.to(roomId).emit('offer', { offer, from: socket.id });
    });

    socket.on('answer', ({ answer, roomId }) => {
        console.log('Relaying answer in room:', roomId);
        socket.to(roomId).emit('answer', { answer, from: socket.id });
    });

    socket.on('ice-candidate', ({ candidate, roomId }) => {
        console.log('Relaying ICE candidate for room:', roomId);
        socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id });
    });

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on('leave-room', (roomId) => {
        socket.leave(roomId);
        // Notify other participants that user has left
        socket.to(roomId).emit('user-disconnected', socket.id);
    });

    socket.on('send-message', (data) => {
        socket.to(data.roomId).emit('receive-message', data);
    });

    socket.on('end-call', ({ roomId }) => {
        console.log('Call ended in room:', roomId);
        // Notify everyone in the room except sender
        socket.to(roomId).emit('call-ended');
        // Leave the room
        socket.leave(roomId);
    });

    // Handle call initiation
    socket.on('initiate-call', ({ targetUserId, roomId }) => {
        console.log('Call initiated:', { targetUserId, roomId });
        const targetSocketId = connectedUsers.get(targetUserId);

        if (targetSocketId) {
            io.to(targetSocketId).emit('incoming-call', {
                roomId,
                callerId: socket.userId
            });
        } else {
            socket.emit('call-failed', { message: 'User is not online' });
        }
    });

    // Handle call acceptance
    socket.on('accept-call', ({ roomId, callerId }) => {
        socket.to(callerId).emit('call-accepted', {
            roomId,
            accepterId: socket.id
        });
    });

    // Handle call rejection
    socket.on('reject-call', ({ roomId, callerId }) => {
        socket.to(callerId).emit('call-rejected', {
            roomId,
            rejecterId: socket.id
        });
    });

    socket.on('join-random-queue', async (userData) => {
        try {
            console.log('User joined random queue:', userData.username);

            // First, check if user is already in queue
            if (waitingUsers.has(userData.userId)) {
                return;
            }

            // Find another waiting user who isn't the current user
            let match = null;
            for (const [waitingUserId, waitingUser] of waitingUsers) {
                if (waitingUserId !== userData.userId) {
                    match = waitingUser;
                    waitingUsers.delete(waitingUserId);
                    break;
                }
            }

            if (match) {
                // Create a unique room ID
                const roomId = `random-${Date.now()}`;

                // Notify both users about the match
                io.to(match.socketId).emit('random-match-found', {
                    roomId,
                    peer: {
                        username: userData.username,
                        id: userData.userId
                    }
                });

                socket.emit('random-match-found', {
                    roomId,
                    peer: {
                        username: match.username,
                        id: match.userId
                    }
                });

            } else {
                // Add current user to waiting queue
                waitingUsers.set(userData.userId, {
                    socketId: socket.id,
                    userId: userData.userId,
                    username: userData.username
                });
                socket.emit('waiting-for-match');
            }

        } catch (error) {
            console.error('Error in random matching:', error);
            socket.emit('matching-error', { message: 'Error finding match' });
        }
    });

    socket.on('leave-random-queue', (userId) => {
        // Remove user from waiting queue
        if (waitingUsers.has(userId)) {
            waitingUsers.delete(userId);
            console.log(`User ${userId} left random queue`);
        }
    });

    socket.on('join-waiting-room', async (userData) => {
        try {
            console.log('User joined waiting room:', userData.username);
            
            // Find if there's anyone else in the waiting room
            const waitingUsers = Array.from(waitingRoom);
            const availableMatch = waitingUsers.find(user => 
                user.userId !== userData.userId && 
                user.socketId !== socket.id
            );

            if (availableMatch) {
                // Remove the matched user from waiting room
                waitingRoom.delete(availableMatch);

                // Create a unique room ID
                const roomId = `random-${Date.now()}`;

                // Notify both users about the match
                io.to(availableMatch.socketId).emit('match-found', {
                    roomId,
                    peer: {
                        username: userData.username,
                        id: userData.userId
                    }
                });

                socket.emit('match-found', {
                    roomId,
                    peer: {
                        username: availableMatch.username,
                        id: availableMatch.userId
                    }
                });

                console.log(`Matched users: ${userData.username} and ${availableMatch.username}`);
            } else {
                // Add current user to waiting room
                const userInfo = {
                    socketId: socket.id,
                    userId: userData.userId,
                    username: userData.username
                };
                waitingRoom.add(userInfo);
                socket.emit('waiting-for-match');
                console.log(`Added ${userData.username} to waiting room. Current size: ${waitingRoom.size}`);
            }
        } catch (error) {
            console.error('Error in waiting room:', error);
            socket.emit('matching-error', { message: 'Error finding match' });
        }
    });

    socket.on('leave-waiting-room', (userId) => {
        // Remove user from waiting room
        for (const user of waitingRoom) {
            if (user.userId === userId) {
                waitingRoom.delete(user);
                console.log(`User ${userId} left waiting room. Current size: ${waitingRoom.size}`);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    httpServer.close(() => process.exit(1));
})
