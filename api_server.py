from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import json
import os
import time
import threading
import queue
import logging
import sounddevice as sd
import numpy as np
from faster_whisper import WhisperModel
from playsound import playsound
import uuid
from datetime import datetime

# --- Configuration ---
AUDIO_DIR = "audio"
SCRIPT_CUES_FILE = "script_cues.json"
SAMPLE_RATE = 16000
CHUNK_SIZE = 1024
WHISPER_MODEL_SIZE = "base"
LANGUAGE = "en"
SILENCE_THRESHOLD = 0.01
SILENCE_DURATION = 1.0
MATCH_COOLDOWN = 5

# --- Flask App Setup ---
app = Flask(__name__)
app.config['SECRET_KEY'] = 'theatre_dubbing_secret_key'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO,
                    format='[%(asctime)s.%(msecs)03d] %(message)s',
                    datefmt='%H:%M:%S')
log = logging.getLogger(__name__)

# --- Global Variables ---
audio_queue = queue.Queue()
transcription_queue = queue.Queue()
playback_queue = queue.Queue()
script_cues = []
last_played_cue_id = None
last_match_time = 0
current_cue_index = -1
is_recording = False
is_system_running = False
transcription_history = []
system_stats = {
    'total_detections': 0,
    'successful_matches': 0,
    'start_time': None
}

# --- Load Script Cues ---
def load_script_cues():
    global script_cues
    try:
        with open(SCRIPT_CUES_FILE, 'r', encoding='utf-8') as f:
            script_cues = json.load(f)
        log.info(f"Loaded {len(script_cues)} script cues from {SCRIPT_CUES_FILE}")
        socketio.emit('cues_updated', {'cues': script_cues})
        return True
    except FileNotFoundError:
        log.error(f"Error: {SCRIPT_CUES_FILE} not found.")
        return False
    except json.JSONDecodeError:
        log.error(f"Error: Could not decode JSON from {SCRIPT_CUES_FILE}.")
        return False

# --- Save Script Cues ---
def save_script_cues():
    try:
        with open(SCRIPT_CUES_FILE, 'w', encoding='utf-8') as f:
            json.dump(script_cues, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        log.error(f"Error saving script cues: {e}")
        return False

# --- Audio Recording Thread ---
def audio_recorder():
    global is_recording
    log.info("Starting audio recording...")
    try:
        # List available audio devices and their capabilities
        devices = sd.query_devices()
        log.info(f"Available audio devices: {devices}")
        
        # Try to find a default input device
        default_input_device_info = sd.query_devices(kind='input')
        log.info(f"Default input device info: {default_input_device_info}")

        # Attempt to open the input stream
        with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype='float32', blocksize=CHUNK_SIZE) as stream:
            log.info(f"Audio input stream opened with sample rate: {stream.samplerate}, channels: {stream.channels}")
            while is_recording:
                audio_chunk, overflowed = stream.read(CHUNK_SIZE)
                if overflowed:
                    log.warning("Audio input buffer overflowed!")
                audio_queue.put(audio_chunk.flatten())
    except Exception as e:
        log.error(f"Audio recording error: {e}")
        socketio.emit('system_error', {'error': f"Audio recording error: {e}"})

# --- Transcription Thread ---
def transcriber():
    global is_system_running, system_stats
    log.info(f"Loading Whisper model: {WHISPER_MODEL_SIZE}...")
    socketio.emit('system_status', {'status': 'loading_model', 'message': 'Loading Whisper model...'})
    
    try:
        model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
        log.info("Whisper model loaded.")
        socketio.emit('system_status', {'status': 'model_loaded', 'message': 'Whisper model loaded successfully'})
    except Exception as e:
        log.error(f"Error loading Whisper model: {e}")
        socketio.emit('system_error', {'error': f"Error loading Whisper model: {e}"})
        return

    full_audio_buffer = np.array([])
    last_speech_time = time.time()

    while is_system_running:
        try:
            chunk = audio_queue.get(timeout=1)
            full_audio_buffer = np.concatenate((full_audio_buffer, chunk))

            # Simple VAD: Check if audio chunk contains speech
            rms = np.sqrt(np.mean(chunk**2))
            if rms > SILENCE_THRESHOLD:
                last_speech_time = time.time()

            # If silence detected for a duration, process the accumulated audio
            if time.time() - last_speech_time > SILENCE_DURATION and len(full_audio_buffer) > 0:
                log.info("Silence detected, processing utterance...")
                segments, info = model.transcribe(full_audio_buffer, language=LANGUAGE)
                transcribed_text = " ".join([segment.text for segment in segments])
                if transcribed_text.strip():
                    transcription_queue.put(transcribed_text.strip())
                    system_stats['total_detections'] += 1
                full_audio_buffer = np.array([])
                last_speech_time = time.time()

        except queue.Empty:
            if len(full_audio_buffer) > 0 and time.time() - last_speech_time > SILENCE_DURATION:
                log.info("Timeout/Silence, processing remaining utterance...")
                segments, info = model.transcribe(full_audio_buffer, language=LANGUAGE)
                transcribed_text = " ".join([segment.text for segment in segments])
                if transcribed_text.strip():
                    transcription_queue.put(transcribed_text.strip())
                    system_stats['total_detections'] += 1
                full_audio_buffer = np.array([])
                last_speech_time = time.time()
        except Exception as e:
            log.error(f"Transcription error: {e}")

# --- Playback Thread ---
def audio_playback():
    while is_system_running:
        try:
            audio_file = playback_queue.get(timeout=1)
            if audio_file and os.path.exists(audio_file):
                log.info(f"Playing '{audio_file}'...")
                socketio.emit('audio_playing', {'file': audio_file, 'timestamp': datetime.now().isoformat()})
                playsound(audio_file, block=False)
                log.info(f"Finished playing '{audio_file}'.")
                socketio.emit('audio_finished', {'file': audio_file, 'timestamp': datetime.now().isoformat()})
        except queue.Empty:
            continue
        except Exception as e:
            log.error(f"Audio playback error: {e}")

# --- Main Logic Thread ---
def main_logic():
    global last_match_time, last_played_cue_id, current_cue_index, transcription_history, system_stats

    while is_system_running:
        try:
            transcribed_text = transcription_queue.get(timeout=1)
            timestamp = datetime.now().isoformat()
            log.info(f"Detected: '{transcribed_text}'")
            
            # Add to transcription history
            transcription_entry = {
                'id': str(uuid.uuid4()),
                'text': transcribed_text,
                'timestamp': timestamp,
                'matched_cue': None,
                'played_audio': None
            }
            transcription_history.append(transcription_entry)
            
            # Keep only last 100 transcriptions
            if len(transcription_history) > 100:
                transcription_history.pop(0)
            
            socketio.emit('transcription_detected', transcription_entry)

            if time.time() - last_match_time < MATCH_COOLDOWN:
                log.info("Ignoring match due to cooldown period.")
                continue

            # Extract first 1-2 tokens (normalized)
            tokens = transcribed_text.lower().split()[:2]

            matched_cue = None
            for i, cue in enumerate(script_cues):
                normalized_first_tokens = [t.lower() for t in cue["first_tokens"]]
                if len(tokens) >= len(normalized_first_tokens) and \
                   all(tokens[j] == normalized_first_tokens[j] for j in range(len(normalized_first_tokens))):
                    matched_cue = cue
                    current_cue_index = i
                    break

            if matched_cue:
                log.info(f"Match found: cue {matched_cue['id']} → Playing '{matched_cue['en_audio']}'")
                audio_file = os.path.join(AUDIO_DIR, matched_cue['en_audio'].split('/')[-1])
                playback_queue.put(audio_file)
                last_match_time = time.time()
                last_played_cue_id = matched_cue['id']
                system_stats['successful_matches'] += 1
                
                # Update transcription history
                transcription_entry['matched_cue'] = matched_cue
                transcription_entry['played_audio'] = audio_file
                
                socketio.emit('cue_matched', {
                    'cue': matched_cue,
                    'transcription': transcribed_text,
                    'timestamp': timestamp
                })
            else:
                log.info("No match found for detected text.")

        except queue.Empty:
            pass
        except Exception as e:
            log.error(f"Main logic error: {e}")

# --- API Routes ---

@app.route('/api/status')
def get_status():
    return jsonify({
        'is_recording': is_recording,
        'is_system_running': is_system_running,
        'current_cue_index': current_cue_index,
        'last_played_cue_id': last_played_cue_id,
        'stats': system_stats,
        'uptime': time.time() - system_stats['start_time'] if system_stats['start_time'] else 0
    })

@app.route('/api/cues')
def get_cues():
    return jsonify({'cues': script_cues})

@app.route('/api/cues', methods=['POST'])
def add_cue():
    try:
        new_cue = request.json
        # Validate required fields
        required_fields = ['id', 'hi_text', 'first_tokens', 'en_audio']
        if not all(field in new_cue for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        script_cues.append(new_cue)
        if save_script_cues():
            socketio.emit('cues_updated', {'cues': script_cues})
            return jsonify({'success': True, 'cue': new_cue})
        else:
            return jsonify({'error': 'Failed to save cues'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cues/<int:cue_id>', methods=['PUT'])
def update_cue(cue_id):
    try:
        updated_cue = request.json
        for i, cue in enumerate(script_cues):
            if cue['id'] == cue_id:
                script_cues[i] = updated_cue
                if save_script_cues():
                    socketio.emit('cues_updated', {'cues': script_cues})
                    return jsonify({'success': True, 'cue': updated_cue})
                else:
                    return jsonify({'error': 'Failed to save cues'}), 500
        return jsonify({'error': 'Cue not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cues/<int:cue_id>', methods=['DELETE'])
def delete_cue(cue_id):
    try:
        global script_cues
        script_cues = [cue for cue in script_cues if cue['id'] != cue_id]
        if save_script_cues():
            socketio.emit('cues_updated', {'cues': script_cues})
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to save cues'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transcriptions')
def get_transcriptions():
    return jsonify({'transcriptions': transcription_history})

@app.route('/api/play/<int:cue_id>')
def play_cue(cue_id):
    try:
        cue = next((c for c in script_cues if c['id'] == cue_id), None)
        if cue:
            audio_file = os.path.join(AUDIO_DIR, cue['en_audio'].split('/')[-1])
            playback_queue.put(audio_file)
            global last_played_cue_id, last_match_time, current_cue_index
            last_played_cue_id = cue['id']
            last_match_time = time.time()
            current_cue_index = next((i for i, c in enumerate(script_cues) if c['id'] == cue_id), -1)
            return jsonify({'success': True, 'cue': cue})
        else:
            return jsonify({'error': 'Cue not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/control/<action>')
def control_system(action):
    global is_recording, is_system_running, current_cue_index, last_played_cue_id, last_match_time
    
    try:
        if action == 'start':
            if not is_system_running:
                is_system_running = True
                is_recording = True
                system_stats['start_time'] = time.time()
                
                # Start threads
                threading.Thread(target=audio_recorder, daemon=True).start()
                threading.Thread(target=transcriber, daemon=True).start()
                threading.Thread(target=audio_playback, daemon=True).start()
                threading.Thread(target=main_logic, daemon=True).start()
                
                socketio.emit('system_status', {'status': 'started', 'message': 'System started successfully'})
                return jsonify({'success': True, 'message': 'System started'})
            else:
                return jsonify({'error': 'System already running'}), 400
                
        elif action == 'stop':
            is_system_running = False
            is_recording = False
            socketio.emit('system_status', {'status': 'stopped', 'message': 'System stopped'})
            return jsonify({'success': True, 'message': 'System stopped'})
            
        elif action == 'next':
            if current_cue_index < len(script_cues) - 1:
                current_cue_index += 1
                cue = script_cues[current_cue_index]
                audio_file = os.path.join(AUDIO_DIR, cue['en_audio'].split('/')[-1])
                playback_queue.put(audio_file)
                last_played_cue_id = cue['id']
                last_match_time = time.time()
                return jsonify({'success': True, 'cue': cue})
            else:
                return jsonify({'error': 'Already at last cue'}), 400
                
        elif action == 'previous':
            if current_cue_index > 0:
                current_cue_index -= 1
                cue = script_cues[current_cue_index]
                audio_file = os.path.join(AUDIO_DIR, cue['en_audio'].split('/')[-1])
                playback_queue.put(audio_file)
                last_played_cue_id = cue['id']
                last_match_time = time.time()
                return jsonify({'success': True, 'cue': cue})
            else:
                return jsonify({'error': 'Already at first cue'}), 400
                
        elif action == 'repeat':
            if last_played_cue_id is not None:
                cue = next((c for c in script_cues if c['id'] == last_played_cue_id), None)
                if cue:
                    audio_file = os.path.join(AUDIO_DIR, cue['en_audio'].split('/')[-1])
                    playback_queue.put(audio_file)
                    last_match_time = time.time()
                    return jsonify({'success': True, 'cue': cue})
                else:
                    return jsonify({'error': 'Last played cue not found'}), 404
            else:
                return jsonify({'error': 'No cue has been played yet'}), 400
        else:
            return jsonify({'error': 'Invalid action'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audio/<filename>')
def serve_audio(filename):
    return send_from_directory(AUDIO_DIR, filename)

# --- Socket.IO Events ---
@socketio.on('connect')
def handle_connect():
    emit('system_status', {'status': 'connected', 'message': 'Connected to server'})
    emit('cues_updated', {'cues': script_cues})

@socketio.on('disconnect')
def handle_disconnect():
    log.info('Client disconnected')

# --- Initialize ---
if __name__ == '__main__':
    # Load initial cues
    load_script_cues()
    
    # Run the Flask-SocketIO server
    socketio.run(app, host='0.0.0.0', port=2000, debug=False)