import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/Common/ProtectedRoute';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import VideoChat from './components/VideoChat/VideoChat';
import Navbar from './components/Common/Navbar';


const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
    },
});

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <AuthProvider>
                <Router>
                    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                        <Navbar />
                        <div style={{ flex: 1 }}>
                            <Routes>
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                <Route
                                    path="/dashboard"
                                    element={
                                        <ProtectedRoute>
                                            <Dashboard />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/video-chat/:roomId"
                                    element={
                                        <ProtectedRoute>
                                            <VideoChat />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route path="/" element={<Navigate to="/login" />} />
                            </Routes>
                        </div>
                    </div>
                </Router>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;