import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';

// Components
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import CueManager from './components/CueManager';
import TranscriptionLog from './components/TranscriptionLog';
import SystemControls from './components/SystemControls';
import LoadingSpinner from './components/LoadingSpinner';

// Context
import { AppProvider } from './context/AppContext';

function App() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:2000');
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      setLoading(false);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
      setLoading(false);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <AppProvider socket={socket}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Header isConnected={isConnected} />
          
          <main className="container mx-auto px-4 py-6">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/cues" element={<CueManager />} />
              <Route path="/transcriptions" element={<TranscriptionLog />} />
              <Route path="/controls" element={<SystemControls />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AppProvider>
  );
}

export default App;