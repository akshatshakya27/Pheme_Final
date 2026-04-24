import torch
import torchaudio
import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="sounddevice")
import sounddevice as sd
import numpy as np
import threading
from collections import deque

class AudioAnalyzer:
    def __init__(
        self,
        noise_tolerance=10,
        baseline_duration=5000,
        speech_threshold=0.3,
        gain_multiplier=6.0,
        speech_consecutive_frames=2,
        audio_buffer_seconds=20,
    ):
        # noise_tolerance: The "buffer" above ambient noise allowed before alerting. 
        # Increase this number for very noisy environments.
        self.noise_tolerance = noise_tolerance
        
        self.current_volume = 0.0
        self.ambient_baseline = 0.0
        self.audio_alert = False
        self.speech_threshold = speech_threshold
        self.gain_multiplier = gain_multiplier
        self.speech_consecutive_frames = max(1, int(speech_consecutive_frames))
        self.audio_buffer_seconds = max(5, int(audio_buffer_seconds))
        self._speech_streak = 0
        self._audio_lock = threading.Lock()
        self._audio_chunks = deque()
        self._buffered_samples = 0
        self._max_buffer_samples = 0
        
        # Internal state for calculating the dynamic room baseline
        self._history = []
        self._history_max_len = baseline_duration
        self._stream = None
        #Load the VAD AI model
        print("Loading VAD model...")
        self.vad_model, _ = torch.hub.load(repo_or_dir='snakers4/silero-vad', model='silero_vad')
        self.speech_confidence = 0.0
        self.speech_alert = False

    def _audio_callback(self, indata, frames, time, status):
        # Calculate Root Mean Square (RMS) to get the true volume level
        rms = np.sqrt(np.mean(indata**2))
        
        # Scale it to a readable 0-100 format (approximate)
        volume = rms * 1000 
        self.current_volume = volume

        # Maintain a rolling history to calculate the ambient room noise
        self._history.append(volume)
        if len(self._history) > self._history_max_len:
            self._history.pop(0)
        
        # We use the median (not average) so sudden loud claps don't permanently ruin the baseline
        if self._history:
            self.ambient_baseline = np.median(self._history)

        # Alert Logic: Trigger if the current volume spikes above the hum of the room + tolerance
        # We also enforce a hard minimum (e.g., > 2.0) so it doesn't trigger in a dead-silent room
        if self.current_volume > (self.ambient_baseline + self.noise_tolerance) and self.current_volume > 2.0:
            self.audio_alert = True
        else:
            self.audio_alert = False
        # --- AI Voice Activity Detection ---
        # Convert raw audio data into a PyTorch tensor
        raw_chunk = indata.flatten().astype(np.float32)

        with self._audio_lock:
            self._audio_chunks.append(raw_chunk)
            self._buffered_samples += len(raw_chunk)
            while self._buffered_samples > self._max_buffer_samples and self._audio_chunks:
                dropped = self._audio_chunks.popleft()
                self._buffered_samples -= len(dropped)

        audio_tensor = torch.from_numpy(raw_chunk).float()
        
        # --- NEW: Digital Gain Booster ---
        # Multiply the volume by 5.0 to make distant voices significantly louder.
        # You can increase this to 10.0 if the room is still too quiet.
        audio_tensor = audio_tensor * self.gain_multiplier
        
        # Clamp values to strictly stay between -1.0 and 1.0 so we don't crash the AI
        audio_tensor = torch.clamp(audio_tensor, min=-1.0, max=1.0)
        
        # Resample from native rate down to exactly 16000 for the AI
        if self.native_samplerate != 16000:
            audio_tensor = self.resampler(audio_tensor)
            
        # Ensure it is exactly 512 samples
        if len(audio_tensor) > 512:
            audio_tensor = audio_tensor[:512]
        elif len(audio_tensor) < 512:
            padding = 512 - len(audio_tensor)
            audio_tensor = torch.nn.functional.pad(audio_tensor, (0, padding))

        # Run the VAD model
        self.speech_confidence = self.vad_model(audio_tensor, 16000).item()
        
        # Trigger speech after consecutive above-threshold chunks to avoid flicker
        if self.speech_confidence >= self.speech_threshold:
            self._speech_streak += 1
        else:
            self._speech_streak = 0

        self.speech_alert = self._speech_streak >= self.speech_consecutive_frames
        
    def start(self):
        # 1. Dynamically find the default microphone's native sample rate (usually 44100 or 48000)
        device_info = sd.query_devices(kind='input')
        self.native_samplerate = int(device_info['default_samplerate'])
        self._max_buffer_samples = self.native_samplerate * self.audio_buffer_seconds
        
        # 2. Silero VAD strictly needs 32ms chunks of audio. 
        # We calculate exactly how many frames that is at your mic's native speed.
        self.native_blocksize = int(self.native_samplerate * (32 / 1000))
        
        # 3. Setup the PyTorch AI Resampler to convert native audio down to 16000Hz
        self.resampler = torchaudio.transforms.Resample(orig_freq=self.native_samplerate, new_freq=16000)

        # 4. Open the stream using DEFAULT settings. No hardcoded device IDs!
        self._stream = sd.InputStream(
            device=None, 
            callback=self._audio_callback, 
            channels=1, 
            samplerate=self.native_samplerate, 
            blocksize=self.native_blocksize
        )
        self._stream.start()

    def stop(self):
        if self._stream:
            self._stream.stop()
            self._stream.close()

    def get_recent_audio_pcm16(self, seconds=8):
        sample_rate = getattr(self, "native_samplerate", 0)
        if sample_rate <= 0:
            return None, None

        with self._audio_lock:
            if not self._audio_chunks:
                return None, sample_rate
            chunks = list(self._audio_chunks)

        audio = np.concatenate(chunks) if chunks else np.array([], dtype=np.float32)
        if audio.size == 0:
            return None, sample_rate

        requested = int(max(1, seconds) * sample_rate)
        if audio.size > requested:
            audio = audio[-requested:]

        audio = np.clip(audio, -1.0, 1.0)
        pcm16 = (audio * 32767.0).astype(np.int16)
        return pcm16, sample_rate

    def get_audio_data(self):
        return {
            "volume": round(self.current_volume, 1),
            "baseline": round(self.ambient_baseline, 1),
            "noise_alert": self.audio_alert,      # Renamed for clarity
            "speech_alert": self.speech_alert,    # NEW: True if human speaking
            "speech_conf": round(self.speech_confidence, 2) # NEW: 0.0 to 1.0
        }