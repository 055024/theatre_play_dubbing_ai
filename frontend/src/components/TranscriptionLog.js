import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Mic, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

function TranscriptionLog() {
  const { transcriptions, api, loading } = useApp();
  const [filteredTranscriptions, setFilteredTranscriptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, matched, unmatched
  const [sortOrder, setSortOrder] = useState('desc'); // desc, asc

  useEffect(() => {
    api.fetchTranscriptions();
  }, []);

  useEffect(() => {
    let filtered = [...transcriptions];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.matched_cue && t.matched_cue.hi_text.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply type filter
    if (filterType === 'matched') {
      filtered = filtered.filter(t => t.matched_cue);
    } else if (filterType === 'unmatched') {
      filtered = filtered.filter(t => !t.matched_cue);
    }

    // Apply sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    setFilteredTranscriptions(filtered);
  }, [transcriptions, searchTerm, filterType, sortOrder]);

  const handleRefresh = () => {
    api.fetchTranscriptions();
  };

  const handleExport = () => {
    const csvContent = [
      ['Timestamp', 'Transcribed Text', 'Matched Cue ID', 'Matched Text', 'Audio File'],
      ...filteredTranscriptions.map(t => [
        new Date(t.timestamp).toISOString(),
        t.text,
        t.matched_cue ? t.matched_cue.id : '',
        t.matched_cue ? t.matched_cue.hi_text : '',
        t.played_audio || ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcriptions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getMatchedStats = () => {
    const matched = transcriptions.filter(t => t.matched_cue).length;
    const total = transcriptions.length;
    return { matched, total, percentage: total > 0 ? Math.round((matched / total) * 100) : 0 };
  };

  const stats = getMatchedStats();

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
          <h1 className="text-2xl font-bold text-gray-900">Transcription Log</h1>
          <p className="text-gray-600">View and analyze speech recognition results</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExport}
            className="btn btn-primary flex items-center space-x-2"
            disabled={filteredTranscriptions.length === 0}
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Transcriptions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Mic className="h-8 w-8 text-primary-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Matched Cues</p>
              <p className="text-2xl font-bold text-success-600">{stats.matched}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-success-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unmatched</p>
              <p className="text-2xl font-bold text-warning-600">{stats.total - stats.matched}</p>
            </div>
            <XCircle className="h-8 w-8 text-warning-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Match Rate</p>
              <p className="text-2xl font-bold text-primary-600">{stats.percentage}%</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-sm font-bold text-primary-600">{stats.percentage}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search transcriptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Transcriptions</option>
              <option value="matched">Matched Only</option>
              <option value="unmatched">Unmatched Only</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transcriptions List */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Transcriptions ({filteredTranscriptions.length})
          </h3>
        </div>

        {filteredTranscriptions.length > 0 ? (
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {filteredTranscriptions.map((transcription) => (
              <div key={transcription.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex items-center space-x-1 text-gray-500">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">{formatTime(transcription.timestamp)}</span>
                      </div>
                      {transcription.matched_cue ? (
                        <span className="status-online flex items-center space-x-1">
                          <CheckCircle className="h-3 w-3" />
                          <span>Matched</span>
                        </span>
                      ) : (
                        <span className="status-warning flex items-center space-x-1">
                          <XCircle className="h-3 w-3" />
                          <span>No Match</span>
                        </span>
                      )}
                    </div>

                    <div className="mb-3">
                      <h4 className="text-lg font-medium text-gray-900 mb-1">
                        "{transcription.text}"
                      </h4>
                      {transcription.matched_cue && (
                        <div className="mt-2 p-3 bg-success-50 rounded-lg border border-success-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-success-800">
                                Matched Cue #{transcription.matched_cue.id}
                              </p>
                              <p className="text-success-700">{transcription.matched_cue.hi_text}</p>
                            </div>
                            {transcription.played_audio && (
                              <div className="text-right">
                                <p className="text-xs text-success-600">Played Audio:</p>
                                <p className="text-sm font-medium text-success-800">
                                  {transcription.played_audio.split('/').pop()}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Mic className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || filterType !== 'all' ? 'No matching transcriptions' : 'No transcriptions yet'}
            </h3>
            <p className="text-gray-600">
              {searchTerm || filterType !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Start the system to begin capturing speech transcriptions'
              }
            </p>
          </div>
        )}
      </div>

      {/* Analysis Tips */}
      <div className="card p-6 bg-blue-50 border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">Analysis Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Review unmatched transcriptions to identify missing cues or improve token matching</li>
          <li>• Export data to CSV for detailed analysis in spreadsheet applications</li>
          <li>• Monitor match rates to optimize your cue configuration</li>
          <li>• Use search to quickly find specific phrases or cues</li>
          <li>• Check timestamps to understand system performance during different periods</li>
        </ul>
      </div>
    </div>
  );
}

export default TranscriptionLog;