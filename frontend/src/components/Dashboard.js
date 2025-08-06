import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Play, 
  Pause, 
  Mic, 
  MicOff, 
  Activity, 
  Clock, 
  Target, 
  Volume2,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

function Dashboard() {
  const { systemStatus, cues, transcriptions, systemMessages, currentlyPlaying, api, loading, error } = useApp();
  const [recentTranscriptions, setRecentTranscriptions] = useState([]);

  useEffect(() => {
    // Fetch initial data
    api.fetchStatus();
    api.fetchCues();
    api.fetchTranscriptions();
  }, []);

  useEffect(() => {
    // Update recent transcriptions
    setRecentTranscriptions(transcriptions.slice(0, 5));
  }, [transcriptions]);

  const formatUptime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getMessageIcon = (type) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-danger-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success-500" />;
      case 'transcription':
        return <Mic className="h-4 w-4 text-primary-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleSystemControl = async (action) => {
    try {
      await api.controlSystem(action);
    } catch (error) {
      console.error('Control action failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">System Dashboard</h1>
        <div className="flex items-center space-x-3">
          {systemStatus.is_system_running ? (
            <button
              onClick={() => handleSystemControl('stop')}
              className="btn btn-danger flex items-center space-x-2"
            >
              <Pause className="h-4 w-4" />
              <span>Stop System</span>
            </button>
          ) : (
            <button
              onClick={() => handleSystemControl('start')}
              className="btn btn-success flex items-center space-x-2"
            >
              <Play className="h-4 w-4" />
              <span>Start System</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-danger-500" />
            <span className="text-danger-800 font-medium">Error: {error}</span>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* System Status */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">System Status</p>
              <p className="text-2xl font-bold text-gray-900">
                {systemStatus.is_system_running ? 'Running' : 'Stopped'}
              </p>
            </div>
            <div className={`p-3 rounded-full ${systemStatus.is_system_running ? 'bg-success-100' : 'bg-gray-100'}`}>
              <Activity className={`h-6 w-6 ${systemStatus.is_system_running ? 'text-success-600' : 'text-gray-400'}`} />
            </div>
          </div>
          <div className="mt-4 flex items-center space-x-2">
            {systemStatus.is_recording ? (
              <div className="flex items-center space-x-1 text-success-600">
                <Mic className="h-4 w-4" />
                <span className="text-sm">Recording</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-gray-400">
                <MicOff className="h-4 w-4" />
                <span className="text-sm">Not Recording</span>
              </div>
            )}
          </div>
        </div>

        {/* Uptime */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Uptime</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatUptime(systemStatus.uptime)}
              </p>
            </div>
            <div className="p-3 rounded-full bg-primary-100">
              <Clock className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </div>

        {/* Total Detections */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Detections</p>
              <p className="text-2xl font-bold text-gray-900">
                {systemStatus.stats.total_detections}
              </p>
            </div>
            <div className="p-3 rounded-full bg-warning-100">
              <Mic className="h-6 w-6 text-warning-600" />
            </div>
          </div>
        </div>

        {/* Successful Matches */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Successful Matches</p>
              <p className="text-2xl font-bold text-gray-900">
                {systemStatus.stats.successful_matches}
              </p>
            </div>
            <div className="p-3 rounded-full bg-success-100">
              <Target className="h-6 w-6 text-success-600" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              {systemStatus.stats.total_detections > 0 
                ? `${Math.round((systemStatus.stats.successful_matches / systemStatus.stats.total_detections) * 100)}% match rate`
                : 'No detections yet'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Currently Playing */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Currently Playing</h3>
          {currentlyPlaying ? (
            <div className="flex items-center space-x-3 p-4 bg-primary-50 rounded-lg">
              <Volume2 className="h-5 w-5 text-primary-600" />
              <div>
                <p className="font-medium text-primary-900">{currentlyPlaying.split('/').pop()}</p>
                <p className="text-sm text-primary-600">Audio file playing...</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Volume2 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No audio currently playing</p>
            </div>
          )}
        </div>

        {/* Recent Transcriptions */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transcriptions</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {recentTranscriptions.length > 0 ? (
              recentTranscriptions.map((transcription) => (
                <div key={transcription.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">{transcription.text}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-500">
                      {new Date(transcription.timestamp).toLocaleTimeString()}
                    </p>
                    {transcription.matched_cue && (
                      <span className="status-online">Matched</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Mic className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No transcriptions yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Messages */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Messages</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {systemMessages.length > 0 ? (
            systemMessages.slice(0, 10).map((message) => (
              <div key={message.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded">
                {getMessageIcon(message.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{message.message}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Info className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No system messages</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-600">{cues.length}</p>
            <p className="text-sm text-gray-600">Total Cues</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-success-600">{systemStatus.current_cue_index + 1}</p>
            <p className="text-sm text-gray-600">Current Cue</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-warning-600">{transcriptions.length}</p>
            <p className="text-sm text-gray-600">Transcriptions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-600">
              {systemStatus.stats.total_detections > 0 
                ? Math.round((systemStatus.stats.successful_matches / systemStatus.stats.total_detections) * 100)
                : 0
              }%
            </p>
            <p className="text-sm text-gray-600">Match Rate</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;