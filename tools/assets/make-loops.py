"""Seamless loops (round 18 #212, #216): cut [start, start+L+X], cross-fade the X-second tail into the head,
write mono 16-bit 44.1 kHz WAV (no MP3 encoder padding, which leaves a gap every time a loop repeats)."""
import subprocess, struct, wave, sys, os
os.chdir('/home/user/Dead-Block')
RATE = 44100

def make(src, out, start, length, xfade, filters):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-af', f'atrim={start}:{start + length + xfade},asetpts=PTS-STARTPTS,{filters}',
                          '-ac', '1', '-ar', str(RATE), '-f', 's16le', '-'], capture_output=True, check=True).stdout
    a = list(struct.unpack(f'<{len(raw)//2}h', raw))
    N = int(length * RATE)
    X = int(xfade * RATE)
    assert len(a) >= N + X, (len(a), N + X)
    loop = a[:N]
    for i in range(X):
        k = i / X  # 0 → 1: the head fades in while the tail (what follows the loop's end) fades out
        # equal-power curves keep the level steady through the join
        import math
        fin, fout = math.sin(k * math.pi / 2), math.cos(k * math.pi / 2)
        loop[i] = max(-32768, min(32767, int(a[i] * fin + a[N + i] * fout)))
    with wave.open(out, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(struct.pack(f'<{len(loop)}h', *loop))
    # the join: last sample vs the first
    print(out, f'{N / RATE:.2f}s', 'join', loop[-1], '→', loop[0], f'(step {abs(loop[0] - loop[-1])})')

make('assets-src/audio/humvee startup.mp3', 'public/audio/humvee_idle.wav', 2.0, 10.0, 0.5, 'volume=3dB')
make('assets-src/audio/50calsound.mp3', 'public/audio/mg_loop.wav', 1.12, 1.58, 0.15, 'volume=16dB,alimiter=limit=0.95')
