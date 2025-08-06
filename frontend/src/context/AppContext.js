import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';

const AppContext = createContext();

const initialState = {
  systemStatus: {
    is_recording: false,
    is_system_running: false,
    current_cue_index: -1,
    last_played_cue_id: null,
    stats: {
      total_detections: 0,
      successful_matches: 0,
      start_time: null
    },
    uptime: 0
  },
  cues: [],
  transcriptions: [],
  currentlyPlaying: null,
  systemMessages: [],
  loading: false,
  error: null
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_SYSTEM_STATUS':
      return { ...state, systemStatus: { ...state.systemStatus, ...action.payload } };
    
    case 'SET_CUES':
      return { ...state, cues: action.payload };
    
    case 'ADD_CUE':
      return { ...state, cues: [...state.cues, action.payload] };
    
    case 'UPDATE_CUE':
      return {
        ...state,
        cues: state.cues.map(cue => 
          cue.id === action.payload.id ? action.payload : cue
        )
      };
    
    case 'DELETE_CUE':
      return {
        ...state,
        cues: state.cues.filter(cue => cue.id !== action.payload)
      };
    
    case 'SET_TRANSCRIPTIONS':
      return { ...state, transcriptions: action.payload };
    
    case 'ADD_TRANSCRIPTION':
      return {
        ...state,
        transcriptions: [action.payload, ...state.transcriptions].slice(0, 100)
      };
    
    case 'SET_CURRENTLY_PLAYING':
      return { ...state, currentlyPlaying: action.payload };
    
    case 'ADD_SYSTEM_MESSAGE':
      return {
        ...state,
        systemMessages: [
          {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            ...action.payload
          },
          ...state.systemMessages
        ].slice(0, 50)
      };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    default:
      return state;
  }
}

export function AppProvider({ children, socket }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on('system_status', (data) => {
      dispatch({ type: 'ADD_SYSTEM_MESSAGE', payload: { type: 'info', message: data.message } });
    });

    socket.on('system_error', (data) => {
      dispatch({ type: 'SET_ERROR', payload: data.error });
      dispatch({ type: 'ADD_SYSTEM_MESSAGE', payload: { type: 'error', message: data.error } });
    });

    socket.on('cues_updated', (data) => {
      dispatch({ type: 'SET_CUES', payload: data.cues });
    });

    socket.on('transcription_detected', (data) => {
      dispatch({ type: 'ADD_TRANSCRIPTION', payload: data });
      dispatch({ type: 'ADD_SYSTEM_MESSAGE', payload: { 
        type: 'transcription', 
        message: `Detected: "${data.text}"` 
      }});
    });

    socket.on('cue_matched', (data) => {
      dispatch({ type: 'ADD_SYSTEM_MESSAGE', payload: { 
        type: 'success', 
        message: `Matched cue ${data.cue.id}: "${data.cue.hi_text}"` 
      }});
    });

    socket.on('audio_playing', (data) => {
      dispatch({ type: 'SET_CURRENTLY_PLAYING', payload: data.file });
      dispatch({ type: 'ADD_SYSTEM_MESSAGE', payload: { 
        type: 'info', 
        message: `Playing: ${data.file}` 
      }});
    });

    socket.on('audio_finished', (data) => {
      dispatch({ type: 'SET_CURRENTLY_PLAYING', payload: null });
    });

    return () => {
      socket.off('system_status');
      socket.off('system_error');
      socket.off('cues_updated');
      socket.off('transcription_detected');
      socket.off('cue_matched');
      socket.off('audio_playing');
      socket.off('audio_finished');
    };
  }, [socket]);

  // API functions
  const api = {
    async fetchStatus() {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const response = await axios.get('/api/status');
        dispatch({ type: 'SET_SYSTEM_STATUS', payload: response.data });
        dispatch({ type: 'SET_LOADING', payload: false });
        return response.data;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },

    async fetchCues() {
      try {
        const response = await axios.get('/api/cues');
        dispatch({ type: 'SET_CUES', payload: response.data.cues });
        return response.data.cues;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },

    async addCue(cue) {
      try {
        const response = await axios.post('/api/cues', cue);
        dispatch({ type: 'ADD_CUE', payload: response.data.cue });
        return response.data.cue;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.response?.data?.error || error.message });
        throw error;
      }
    },

    async updateCue(cueId, cue) {
      try {
        const response = await axios.put(`/api/cues/${cueId}`, cue);
        dispatch({ type: 'UPDATE_CUE', payload: response.data.cue });
        return response.data.cue;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.response?.data?.error || error.message });
        throw error;
      }
    },

    async deleteCue(cueId) {
      try {
        await axios.delete(`/api/cues/${cueId}`);
        dispatch({ type: 'DELETE_CUE', payload: cueId });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.response?.data?.error || error.message });
        throw error;
      }
    },

    async fetchTranscriptions() {
      try {
        const response = await axios.get('/api/transcriptions');
        dispatch({ type: 'SET_TRANSCRIPTIONS', payload: response.data.transcriptions });
        return response.data.transcriptions;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },

    async playCue(cueId) {
      try {
        const response = await axios.get(`/api/play/${cueId}`);
        return response.data;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.response?.data?.error || error.message });
        throw error;
      }
    },

    async controlSystem(action) {
      try {
        const response = await axios.get(`/api/control/${action}`);
        // Update system status after control action
        await this.fetchStatus();
        return response.data;
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.response?.data?.error || error.message });
        throw error;
      }
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value = {
    ...state,
    api,
    clearError
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}