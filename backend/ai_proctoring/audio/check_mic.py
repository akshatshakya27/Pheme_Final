import sounddevice as sd

print("Available Audio Devices:")
print(sd.query_devices())