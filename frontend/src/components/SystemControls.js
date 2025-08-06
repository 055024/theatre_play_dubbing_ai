import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  RotateCcw,
  Settings,
  Volume2,
  Mic,
  Activity,
  AlertTriangle
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

function SystemControls() {
  const { systemStatus, cues, api, loading, error } = useApp();
  const [selectedCue, setSelectedCue] = useState('');

  useEffect(() => {
    api.fetchStatus();
    api.fetchCues();
  }, []);

  const handleSystemControl = async (action) => {
    try {
      await api.controlSystem(action);
    } catch (error) {
      console.error('Control action failed:', error);
    }
  };

  const handlePlayCue = async (cueId) => {
    try {
      await api.playCue(parseInt(cueId));
    } catch (error) {
      console.error('Failed to play cue:', error);
    }
  };

  const getCurrentCue = () => {
    if (systemStatus.current_cue_index >= 0 && systemStatus.current_cue_index < cues.length) {
      return cues[systemStatus.current_cue_index];
    }
    return null;
  };

  const currentCue = getCurrentCue();

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Controls</h1>
        <p className="text-gray-600">Control system operation and manual cue playback</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-danger-500" />
            <span className="text-danger-800 font-medium">Error: {error}</span>
          </div>
        </div>
      )}

      {/* System Status */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${systemStatus.is_system_running ? 'bg-success-100' : 'bg-gray-100'}`}>
              <Activity className={`h-5 w-5 ${systemStatus.is_system_running ? 'text-success-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">System</p>
              <p className="font-semibold text-gray-900">
                {systemStatus.is_system_running ? 'Running' : 'Stopped'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${systemStatus.is_recording ? 'bg-danger-100' : 'bg-gray-100'}`}>
              <Mic className={`h-5 w-5 ${systemStatus.is_recording ? 'text-danger-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Recording</p>
              <p className="font-semibold text-gray-900">
                {systemStatus.is_recording ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-primary-100">
              <Volume2 className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Cue</p>
              <p className="font-semibold text-gray-900">
                {currentCue ? `#${currentCue.id}` : 'None'}
              </p>
            </div>
          </div>
        </div>

        {/* System Control Buttons */}
        <div className="flex items-center space-x-4">
          {systemStatus.is_system_running ? (
            <button
              onClick={() => handleSystemControl('stop')}
              className="btn btn-danger btn-lg flex items-center space-x-2"
            >
              <Pause className="h-5 w-5" />
              <span>Stop System</span>
            </button>
          ) : (
            <button
              onClick={() => handleSystemControl('start')}
              className="btn btn-success btn-lg flex items-center space-x-2"
            >
              <Play className="h-5 w-5" />
              <span>Start System</span>
            </button>
          )}
        </div>
      </div>

      {/* Current Cue Info */}
      {currentCue && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Cue</h3>
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                    Cue #{currentCue.id}
                  </span>
                </div>
                <h4 className="text-lg font-medium text-primary-900 mb-1">
                  {currentCue.hi_text}
                </h4>
                <p className="text-sm text-primary-700">
                  Audio: {currentCue.en_audio}
                </p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-sm text-primary-600">Triggers:</span>
                  {Array.isArray(currentCue.first_tokens) ? (
                    currentCue.first_tokens.map((token, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-200 text-primary-800"
                      >
                        {token}
                      </span>
                    ))
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-200 text-primary-800">
                      {currentCue.first_tokens}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Controls */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Manual Controls</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Navigation Controls */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Navigation</h4>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleSystemControl('previous')}
                className="btn btn-secondary flex items-center space-x-2"
                disabled={!systemStatus.is_system_running || systemStatus.current_cue_index <= 0}
              >
                <SkipBack className="h-4 w-4" />
                <span>Previous</span>
              </button>
              
              <button
                onClick={() => handleSystemControl('repeat')}
                className="btn btn-warning flex items-center space-x-2"
                disabled={!systemStatus.last_played_cue_id}
              >
                <RotateCcw className="h-4 w-4" />
                <span>Repeat</span>
              </button>
              
              <button
                onClick={() => handleSystemControl('next')}
                className="btn btn-secondary flex items-center space-x-2"
                disabled={!systemStatus.is_system_running || systemStatus.current_cue_index >= cues.length - 1}
              >
                <SkipForward className="h-4 w-4" />
                <span>Next</span>
              </button>
            </div>
          </div>

          {/* Direct Cue Selection */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Direct Playback</h4>
            <div className="flex items-center space-x-3">
              <select
                value={selectedCue}
                onChange={(e) => setSelectedCue(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select a cue...</option>
                {cues.map((cue) => (
                  <option key={cue.id} value={cue.id}>
                    #{cue.id} - {cue.hi_text}
                  </option>
                ))}
              </select>
              <button
                onClick={() => selectedCue && handlePlayCue(selectedCue)}
                className="btn btn-primary flex items-center space-x-2"
                disabled={!selectedCue}
              >
                <Play className="h-4 w-4" />
                <span>Play</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cue List */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">All Cues ({cues.length})</h3>
        
        {cues.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {cues.map((cue) => (
              <div
                key={cue.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  currentCue && currentCue.id === cue.id
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => handlePlayCue(cue.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    #{cue.id}
                  </span>
                  <Play className="h-4 w-4 text-gray-400" />
                </div>
                <h5 className="font-medium text-gray-900 mb-1 text-sm">
                  {cue.hi_text}
                </h5>
                <p className="text-xs text-gray-500 mb-2">
                  {cue.en_audio.split('/').pop()}
                </p>
                <div className="flex flex-wrap gap-1">
                  {Array.isArray(cue.first_tokens) ? (
                    cue.first_tokens.map((token, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700"
                      >
                        {token}
                      </span>
                    ))
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">
                      {cue.first_tokens}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Settings className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No cues configured</p>
            <p className="text-sm">Add cues in the Cue Manager to enable manual controls</p>
          </div>
        )}
      </div>

      {/* Control Tips */}
      <div className="card p-6 bg-green-50 border-green-200">
        <h4 className="font-semibold text-green-900 mb-2">Control Tips</h4>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• Start the system to enable automatic speech recognition and cue matching</li>
          <li>• Use Previous/Next buttons to navigate through cues sequentially</li>
          <li>• Click on any cue in the list to play it directly</li>
          <li>• The Repeat button replays the last triggered cue</li>
          <li>• Manual controls work even when the system is running</li>
        </ul>
      </div>
    </div>
  );
}

export default SystemControls;