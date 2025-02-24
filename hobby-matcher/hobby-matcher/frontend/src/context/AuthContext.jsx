import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
const API_URL = import.meta.env.VITE_API_URL;

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const socket = io(API_URL);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            setUser(JSON.parse(localStorage.getItem('user')));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (user) {
            // Create new socket connection
            const newSocket = io(API_URL);
            
            // Register user
            newSocket.emit('register-user', user._id);

            // Listen for user status changes
            newSocket.on('user-status-change', ({ userId, isOnline }) => {
                setOnlineUsers(prev => {
                    const newSet = new Set(prev);
                    if (isOnline) {
                        newSet.add(userId);
                    } else {
                        newSet.delete(userId);
                    }
                    return newSet;
                });
            });

            // Request initial online users
            newSocket.emit('get-online-users');

            // Handle initial online users list
            newSocket.on('online-users-list', (onlineUserIds) => {
                setOnlineUsers(new Set(onlineUserIds));
            });

            return () => {
                newSocket.disconnect();
            };
        }
    }, [user]);

    const login = async (email, password) => {
        try {
            const response = await axios.post(`${API_URL}/api/auth/login`, {
                email,
                password
            });
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data));
            setUser(response.data);
            setError(null);
            return response.data;
        } catch (err) {
            setError(err.response?.data?.message || 'An error occurred');
            throw err;
        }
    };

    const register = async (userData) => {
        try {
            const response = await axios.post(`${API_URL}/api/auth/register`, userData);
            setError(null);
            return response.data;
        } catch (err) {
            setError(err.response?.data?.message || 'An error occurred');
            throw err;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            error,
            login,
            register,
            logout,
            onlineUsers
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);