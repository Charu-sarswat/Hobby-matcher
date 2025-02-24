import React, { useEffect } from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';

const WaitingRoom = () => {
    const navigate = useNavigate();
    const { socket, user } = useAuth();

    // useEffect(() => {
    //     if (socket) {
    //         // Listen for match found
    //         socket.on('random-match-found', ({ roomId, peer }) => {
    //             console.log('Match found:', peer.username);
    //             alert(`Connected with ${peer.username}!`);
    //             navigate(`/video-chat/${roomId}`);
    //         });

    //         // Listen for errors
    //         socket.on('matching-error', ({ message }) => {
    //             alert(message);
    //             navigate('/dashboard');
    //         });
    //     }

    //     return () => {
    //         if (socket) {
    //             socket.off('random-match-found');
    //             socket.off('matching-error');
    //         }
    //     };
    // }, [socket, navigate]);


    useEffect(() => {
        // Listen for a match being found
        socket.on('random-match-found', ({ roomId, peer }) => {
            console.log('Match found:', roomId, peer);
            // Navigate to the video chat room once a match is found
            navigate(/video-chat/${roomId});
        });

        // Cleanup listener on unmount
        return () => {
            socket.off('random-match-found');
        };
    }, [socket, navigate]);


   

    const handleCancel = () => {
        if (socket && user) {
            socket.emit('leave-random-queue', user._id);
        }
        navigate('/dashboard');
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <Box
                sx={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
                    color: 'white',
                    gap: 3
                }}
            >
                <CircularProgress 
                    size={60} 
                    sx={{ 
                        color: 'white',
                        filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.3))'
                    }} 
                />
                <Typography 
                    variant="h5" 
                    sx={{ 
                        textAlign: 'center',
                        textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                >
                    Looking for someone to talk to...
                </Typography>
                <Button
                    variant="contained"
                    onClick={handleCancel}
                    sx={{
                        mt: 2,
                        background: 'rgba(255, 255, 255, 0.2)',
                        backdropFilter: 'blur(10px)',
                        '&:hover': {
                            background: 'rgba(255, 255, 255, 0.3)',
                        },
                    }}
                >
                    Cancel
                </Button>
            </Box>
        </motion.div>
    );
};

export default WaitingRoom;