import './Dashboard.css';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import io from 'socket.io-client';
import {
    Container,
    Grid,
    Paper,
    Typography,
    Button,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Chip,
    Box,
    Stack,
    CircularProgress
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import VideocamIcon from '@mui/icons-material/Videocam';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ExploreIcon from '@mui/icons-material/Explore';
import { motion } from 'framer-motion';
import LogoutIcon from '@mui/icons-material/Logout';
import DashboardIcon from '@mui/icons-material/Dashboard';
const API_URL = import.meta.env.VITE_API_URL;

const Dashboard = () => {
    const { user, logout, onlineUsers } = useAuth();
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const [socket, setSocket] = useState(null);

    const fetchMatches = async () => {
        try {
            // const response = await axios.get('http://localhost:5000/api/users/matches', {
                const response = await axios.get(`${API_URL}/api/users/matches`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            // Ensure we're setting an array of matches
            setMatches(response.data.matches || []);
            setError(null);
        } catch (error) {
            console.error('Error fetching matches:', error);
            setError('Failed to fetch matches');
            setMatches([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMatches();
    }, []);

    useEffect(() => {
        // Create socket connection
       // const newSocket = io('http://localhost:5000');https://hobby-matcher-7-s60w.onrender.com
       const newSocket = io(API_URL)
        // Debug logs for socket connection
        newSocket.on('connect', () => {
            console.log('Socket Connected:', newSocket.id);
            // Register user ID with socket
            if (user?._id) {
                console.log('Registering user:', user._id);
                newSocket.emit('register-user', user._id);
            }
        });

        // Modified incoming call handler
        newSocket.on('incoming-call', ({ roomId, callerId }) => {
            console.log('Incoming call from:', callerId);
            
            // Force the confirm dialog to appear in the main thread
            setTimeout(() => {
                const accept = window.confirm('Incoming video call. Would you like to accept?');
                console.log('Call response:', accept ? 'accepted' : 'rejected');
                
                if (accept) {
                    newSocket.emit('accept-call', { roomId, callerId });
                    navigate(`/video-chat/${roomId}`);
                } else {
                    newSocket.emit('reject-call', { roomId, callerId });
                }
            }, 100);
        });

        setSocket(newSocket);

        return () => {
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, [user?._id]);

    const handleStartChat = (matchId) => {
        console.log('Starting chat with:', matchId);
        const roomId = [user._id, matchId].sort().join('-');
        
        // Emit call initiation
        socket.emit('initiate-call', {
            targetUserId: matchId,
            roomId
        });

        navigate(`/video-chat/${roomId}`);
    };

    // const handleLogout = () => {
    //     logout();
    //     navigate('/login');
    // };

    // New function to group matches
    const groupedMatches = () => {
        if (!matches || !user?.hobbies) return { similar: [], different: [] };

        return matches.reduce((acc, match) => {
            // Calculate percentage of common hobbies
            const commonCount = match.commonHobbies?.length || 0;
            const totalUserHobbies = user.hobbies.length;
            const matchPercentage = (commonCount / totalUserHobbies) * 100;

            // Add matchPercentage to the match object
            const matchWithScore = {
                ...match,
                matchPercentage: Math.round(matchPercentage)
            };

            if (matchPercentage >= 20) {
                acc.similar.push(matchWithScore);
            } else {
                acc.different.push(matchWithScore);
            }
            return acc;
        }, { similar: [], different: [] });
    };

    const MatchListSection = ({ matches, title }) => (
        <Paper sx={{ p: 2, mb: 3 }} className="match-section">
            <Typography variant="h6" gutterBottom>
                {title}
            </Typography>
            {matches.length > 0 ? (
                <List>
                    {matches.map((match) => (
                        <ListItem
                            key={match._id}
                            className="match-item"
                            secondaryAction={
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Box className="similarity-score">
                                        <CircularProgress
                                            variant="determinate"
                                            value={match.matchPercentage}
                                            size={40}
                                            thickness={4}
                                            sx={{
                                                color: match.matchPercentage >= 50 ? '#4CAF50' : '#2196F3'
                                            }}
                                        />
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '100%',
                                                height: '100%'
                                            }}
                                        >
                                            <Typography
                                                variant="caption"
                                                sx={{ color: 'white', fontWeight: 'bold' }}
                                            >
                                                {`${match.matchPercentage}%`}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Button
                                        variant="contained"
                                        onClick={() => handleStartChat(match._id)}
                                        startIcon={<VideocamIcon />}
                                        className="chat-button"
                                        sx={{
                                            color: 'white',
                                            fontWeight: 500,
                                            textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                            letterSpacing: '0.5px'
                                        }}
                                    >
                                        Chat
                                    </Button>
                                </Stack>
                            }
                        >
                            <ListItemAvatar>
                                <Avatar className="user-avatar">{match.username[0]}</Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography component="span" variant="body1">
                                            {match.username}
                                        </Typography>
                                        {match.isOnline && (
                                            <Box className="online-indicator" />
                                        )}
                                    </Box>
                                }
                                secondary={
                                    <Box component="span">
                                        <Typography 
                                            component="span" 
                                            variant="body2" 
                                            color="text.secondary"
                                            display="block"
                                        >
                                            Hobbies: {match.hobbies.join(', ')}
                                        </Typography>
                                        {match.commonHobbies && match.commonHobbies.length > 0 && (
                                            <Typography 
                                                component="span" 
                                                variant="body2" 
                                                color="primary"
                                                display="block"
                                            >
                                                Common Interests: {match.commonHobbies.join(', ')}
                                            </Typography>
                                        )}
                                    </Box>
                                }
                            />
                        </ListItem>
                    ))}
                </List>
            ) : (
                <Typography variant="body1">No matches found</Typography>
            )}
        </Paper>
    );

    if (loading) {
        return (
            <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Container>
        );
    }

    if (error) {
        return (
            <Container sx={{ mt: 4 }}>
                <Typography color="error">{error}</Typography>
            </Container>
        );
    }

    const { similar, different } = groupedMatches();

    return (
        <Container sx={{ mt: 4 }}>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
            </motion.div>

            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <Paper 
                        sx={{ 
                            p: 3,
                            background: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
                            color: 'white',
                            position: 'relative',
                            overflow: 'hidden'
                        }} 
                        className="profile-card"
                    >
                        <Box className="profile-background-animation" />
                        <Typography variant="h4" gutterBottom fontWeight="bold">
                            Welcome, {user?.username}!
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            Your Hobbies: 
                            <Box sx={{ mt: 2 }} className="hobby-tags">
                                {user?.hobbies?.map((hobby, index) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        key={hobby}
                                    >
                                        <Chip 
                                            label={hobby}
                                            className="hobby-tag"
                                            sx={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                                color: 'white',
                                                '&:hover': {
                                                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                                }
                                            }}
                                        />
                                    </motion.div>
                                ))}
                            </Box>
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12}>
                    <Box className="matches-container">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <Paper 
                                sx={{ 
                                    p: 2, 
                                    mb: 3,
                                    background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',
                                    color: 'white'
                                }} 
                                className="match-section similar-interests"
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <FavoriteIcon />
                                    <Typography variant="h6">People with Similar Interests</Typography>
                                </Box>
                                <MatchListSection matches={similar} isDark />
                            </Paper>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            <Paper 
                                sx={{ 
                                    p: 2,
                                    background: 'linear-gradient(135deg, #4CAF50 0%, #45B649 100%)',
                                    color: 'white'
                                }} 
                                className="match-section different-interests"
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <ExploreIcon />
                                    <Typography variant="h6">Discover New Interests</Typography>
                                </Box>
                                <MatchListSection matches={different} isDark />
                            </Paper>
                        </motion.div>
                    </Box>
                </Grid>
            </Grid>
        </Container>
    );
};

export default Dashboard;