import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Save, 
  X, 
  FileText,
  Volume2,
  Hash
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

function CueManager() {
  const { cues, api, loading, error } = useApp();
  const [editingCue, setEditingCue] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    hi_text: '',
    first_tokens: [],
    en_audio: ''
  });

  useEffect(() => {
    api.fetchCues();
  }, []);

  const resetForm = () => {
    setFormData({
      id: '',
      hi_text: '',
      first_tokens: [],
      en_audio: ''
    });
    setEditingCue(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const cueData = {
        ...formData,
        id: parseInt(formData.id),
        first_tokens: Array.isArray(formData.first_tokens) 
          ? formData.first_tokens 
          : formData.first_tokens.split(',').map(token => token.trim().toLowerCase())
      };

      if (editingCue) {
        await api.updateCue(editingCue.id, cueData);
      } else {
        await api.addCue(cueData);
      }
      
      resetForm();
    } catch (error) {
      console.error('Failed to save cue:', error);
    }
  };

  const handleEdit = (cue) => {
    setFormData({
      id: cue.id.toString(),
      hi_text: cue.hi_text,
      first_tokens: Array.isArray(cue.first_tokens) ? cue.first_tokens.join(', ') : cue.first_tokens,
      en_audio: cue.en_audio
    });
    setEditingCue(cue);
    setShowAddForm(true);
  };

  const handleDelete = async (cueId) => {
    if (window.confirm('Are you sure you want to delete this cue?')) {
      try {
        await api.deleteCue(cueId);
      } catch (error) {
        console.error('Failed to delete cue:', error);
      }
    }
  };

  const handlePlay = async (cueId) => {
    try {
      await api.playCue(cueId);
    } catch (error) {
      console.error('Failed to play cue:', error);
    }
  };

  const getNextCueId = () => {
    if (cues.length === 0) return 1;
    return Math.max(...cues.map(cue => cue.id)) + 1;
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cue Manager</h1>
          <p className="text-gray-600">Manage script cues and audio mappings</p>
        </div>
        <button
          onClick={() => {
            setFormData({ ...formData, id: getNextCueId().toString() });
            setShowAddForm(true);
          }}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Cue</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
          <p className="text-danger-800">Error: {error}</p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingCue ? 'Edit Cue' : 'Add New Cue'}
            </h3>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cue ID
                </label>
                <input
                  type="number"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="input"
                  required
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Audio File Path
                </label>
                <input
                  type="text"
                  value={formData.en_audio}
                  onChange={(e) => setFormData({ ...formData, en_audio: e.target.value })}
                  className="input"
                  placeholder="audio/1.wav"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hindi/Sanskrit Text
              </label>
              <input
                type="text"
                value={formData.hi_text}
                onChange={(e) => setFormData({ ...formData, hi_text: e.target.value })}
                className="input"
                placeholder="श्रीराम बोलो"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Tokens (comma-separated)
              </label>
              <input
                type="text"
                value={formData.first_tokens}
                onChange={(e) => setFormData({ ...formData, first_tokens: e.target.value })}
                className="input"
                placeholder="shri, ram"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the first 1-2 words that will trigger this cue, separated by commas
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="submit"
                className="btn btn-primary flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{editingCue ? 'Update Cue' : 'Add Cue'}</span>
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cues List */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Script Cues ({cues.length})</h3>
        </div>

        {cues.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {cues.map((cue) => (
              <div key={cue.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex items-center space-x-1 text-primary-600">
                        <Hash className="h-4 w-4" />
                        <span className="font-semibold">{cue.id}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-gray-500">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{cue.en_audio}</span>
                      </div>
                    </div>
                    
                    <h4 className="text-lg font-medium text-gray-900 mb-1">
                      {cue.hi_text}
                    </h4>
                    
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-sm text-gray-600">Triggers:</span>
                      {Array.isArray(cue.first_tokens) ? (
                        cue.first_tokens.map((token, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
                          >
                            {token}
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                          {cue.first_tokens}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handlePlay(cue.id)}
                      className="btn btn-sm btn-success flex items-center space-x-1"
                      title="Play Audio"
                    >
                      <Play className="h-3 w-3" />
                      <span>Play</span>
                    </button>
                    <button
                      onClick={() => handleEdit(cue)}
                      className="btn btn-sm btn-secondary flex items-center space-x-1"
                      title="Edit Cue"
                    >
                      <Edit className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(cue.id)}
                      className="btn btn-sm btn-danger flex items-center space-x-1"
                      title="Delete Cue"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No cues found</h3>
            <p className="text-gray-600 mb-4">
              Get started by adding your first script cue
            </p>
            <button
              onClick={() => {
                setFormData({ ...formData, id: getNextCueId().toString() });
                setShowAddForm(true);
              }}
              className="btn btn-primary flex items-center space-x-2 mx-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Add First Cue</span>
            </button>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="card p-6 bg-blue-50 border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">Tips for Managing Cues</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Use unique IDs for each cue to maintain proper sequencing</li>
          <li>• First tokens should be the most distinctive words from the beginning of the phrase</li>
          <li>• Audio files should be placed in the 'audio' directory</li>
          <li>• Test each cue by clicking the Play button to ensure audio works correctly</li>
          <li>• Keep first tokens simple and avoid special characters</li>
        </ul>
      </div>
    </div>
  );
}

export default CueManager;