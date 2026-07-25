package com.pills.reminder;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.util.Log;

import java.io.File;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Проигрывает напоминание как одну управляемую последовательность:
 * сначала сигнал, затем сразу голос. stop() прекращает любой текущий этап
 * и не позволяет отложенному голосу запуститься после остановки.
 */
public final class ReminderSequencePlayer {
    private static final String TAG = "ReminderSequencePlayer";

    public static final class Spec {
        public String soundResource = "medicine_classic_maximum.wav";
        public float alarmVolume = 1f;
        public String text = "Пора принять лекарство";
        public float rate = 0.72f;
        public float pitch = 1f;
        public String voiceMode = "android";
        public float voiceVolume = 1f;
        public String voiceName = "";
        public String recordedVoicePath = "";
    }

    public interface Listener {
        void onFinished();
        void onError(Exception error);
    }

    private final Context context;
    private final AudioManager audioManager;
    private final AtomicInteger generation = new AtomicInteger(0);

    private MediaPlayer signalPlayer;
    private MediaPlayer recordedPlayer;
    private TextToSpeech textToSpeech;
    private Listener activeListener;
    private int previousAlarmVolume = -1;
    private boolean completed;

    public ReminderSequencePlayer(Context context) {
        this.context = context.getApplicationContext();
        this.audioManager = (AudioManager) this.context.getSystemService(Context.AUDIO_SERVICE);
    }

    public synchronized void play(Spec requested, Listener listener) {
        stopInternal(false);
        completed = false;
        activeListener = listener;
        final int run = generation.incrementAndGet();
        final Spec spec = sanitize(requested);

        try {
            applyAlarmVolume(spec.alarmVolume);
            int resourceId = rawResourceId(spec.soundResource);
            if (resourceId == 0) {
                throw new IllegalArgumentException("Не найден сигнал: " + spec.soundResource);
            }

            Uri uri = Uri.parse("android.resource://" + context.getPackageName() + "/" + resourceId);
            MediaPlayer player = new MediaPlayer();
            signalPlayer = player;
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            player.setDataSource(context, uri);
            player.setVolume(1f, 1f);
            player.setOnCompletionListener(completedPlayer -> {
                releaseSignal(completedPlayer);
                if (!isActive(run)) return;
                startVoice(spec, run);
            });
            player.setOnErrorListener((failedPlayer, what, extra) -> {
                releaseSignal(failedPlayer);
                fail(run, new IllegalStateException("Ошибка сигнала: " + what + "/" + extra));
                return true;
            });
            player.prepare();
            if (!isActive(run)) {
                releaseSignal(player);
                return;
            }
            player.start();
            Log.i(TAG, "Signal started, generation=" + run + ", resource=" + spec.soundResource);
        } catch (Exception error) {
            fail(run, error);
        }
    }

    public synchronized void stop() {
        generation.incrementAndGet();
        stopInternal(false);
        Log.i(TAG, "Sequence stopped");
    }

    private Spec sanitize(Spec source) {
        Spec result = new Spec();
        if (source == null) return result;
        result.soundResource = safe(source.soundResource, result.soundResource);
        result.alarmVolume = clamp(source.alarmVolume, 0.05f, 1f);
        result.text = safe(source.text, result.text);
        result.rate = clamp(source.rate, 0.5f, 1.2f);
        result.pitch = clamp(source.pitch, 0.7f, 1.3f);
        result.voiceMode = safe(source.voiceMode, "android");
        result.voiceVolume = clamp(source.voiceVolume, 0.05f, 1f);
        result.voiceName = source.voiceName == null ? "" : source.voiceName;
        result.recordedVoicePath = source.recordedVoicePath == null ? "" : source.recordedVoicePath;
        return result;
    }

    private String safe(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private float clamp(float value, float minimum, float maximum) {
        if (Float.isNaN(value) || Float.isInfinite(value)) return maximum;
        return Math.max(minimum, Math.min(maximum, value));
    }

    private int rawResourceId(String resource) {
        String name = resource == null ? "" : resource.trim();
        int dot = name.lastIndexOf('.');
        if (dot > 0) name = name.substring(0, dot);
        return context.getResources().getIdentifier(name, "raw", context.getPackageName());
    }

    private synchronized boolean isActive(int run) {
        return run == generation.get() && !completed;
    }

    private void startVoice(Spec spec, int run) {
        if (!isActive(run)) return;
        if ("off".equals(spec.voiceMode)) {
            finish(run);
            return;
        }
        if ("recorded".equals(spec.voiceMode)) {
            startRecordedVoice(spec, run);
            return;
        }
        startAndroidVoice(spec, run);
    }

    private void startRecordedVoice(Spec spec, int run) {
        File voiceFile = new File(spec.recordedVoicePath);
        if (!voiceFile.exists() || voiceFile.length() == 0) {
            fail(run, new IllegalArgumentException("Запись голоса не найдена"));
            return;
        }
        try {
            MediaPlayer player = new MediaPlayer();
            synchronized (this) {
                if (!isActive(run)) {
                    player.release();
                    return;
                }
                recordedPlayer = player;
            }
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build());
            player.setDataSource(voiceFile.getAbsolutePath());
            player.setVolume(spec.voiceVolume, spec.voiceVolume);
            player.setOnCompletionListener(completedPlayer -> {
                releaseRecorded(completedPlayer);
                finish(run);
            });
            player.setOnErrorListener((failedPlayer, what, extra) -> {
                releaseRecorded(failedPlayer);
                fail(run, new IllegalStateException("Ошибка записи голоса: " + what + "/" + extra));
                return true;
            });
            player.prepare();
            if (!isActive(run)) {
                releaseRecorded(player);
                return;
            }
            player.start();
            Log.i(TAG, "Recorded voice started, generation=" + run);
        } catch (Exception error) {
            fail(run, error);
        }
    }

    private void startAndroidVoice(Spec spec, int run) {
        final TextToSpeech[] holder = new TextToSpeech[1];
        holder[0] = new TextToSpeech(context, status -> {
            TextToSpeech engine = holder[0];
            synchronized (this) {
                if (!isActive(run)) {
                    if (engine != null) engine.shutdown();
                    return;
                }
                textToSpeech = engine;
            }
            if (status != TextToSpeech.SUCCESS || engine == null) {
                fail(run, new IllegalStateException("Голос Android не запустился"));
                return;
            }
            int language = engine.setLanguage(new Locale("ru", "RU"));
            if (language == TextToSpeech.LANG_MISSING_DATA || language == TextToSpeech.LANG_NOT_SUPPORTED) {
                fail(run, new IllegalStateException("Русский голос Android не установлен"));
                return;
            }
            selectVoice(engine, spec.voiceName);
            engine.setSpeechRate(spec.rate);
            engine.setPitch(spec.pitch);
            engine.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build());
            engine.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String utteranceId) {
                    Log.i(TAG, "Android voice started, generation=" + run);
                }

                @Override public void onDone(String utteranceId) {
                    finish(run);
                }

                @Override public void onError(String utteranceId) {
                    fail(run, new IllegalStateException("Ошибка голоса Android"));
                }

                @Override public void onError(String utteranceId, int errorCode) {
                    fail(run, new IllegalStateException("Ошибка голоса Android: " + errorCode));
                }
            });
            Bundle parameters = new Bundle();
            parameters.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, spec.voiceVolume);
            int result = engine.speak(
                spec.text,
                TextToSpeech.QUEUE_FLUSH,
                parameters,
                "medicine-sequence-" + run
            );
            if (result == TextToSpeech.ERROR) {
                fail(run, new IllegalStateException("Android не принял текст для озвучки"));
            }
        });
    }

    private void selectVoice(TextToSpeech engine, String voiceName) {
        if (voiceName == null || voiceName.trim().isEmpty()) return;
        Set<Voice> voices = engine.getVoices();
        if (voices == null) return;
        for (Voice voice : voices) {
            if (voiceName.equals(voice.getName())) {
                engine.setVoice(voice);
                return;
            }
        }
    }

    private synchronized void finish(int run) {
        if (!isActive(run)) return;
        completed = true;
        Listener listener = activeListener;
        activeListener = null;
        stopInternal(true);
        if (listener != null) listener.onFinished();
    }

    private synchronized void fail(int run, Exception error) {
        if (!isActive(run)) return;
        completed = true;
        Listener listener = activeListener;
        activeListener = null;
        stopInternal(true);
        Log.e(TAG, "Sequence failed, generation=" + run, error);
        if (listener != null) listener.onError(error);
    }

    private synchronized void releaseSignal(MediaPlayer player) {
        try { player.release(); } catch (Exception ignored) {}
        if (signalPlayer == player) signalPlayer = null;
    }

    private synchronized void releaseRecorded(MediaPlayer player) {
        try { player.release(); } catch (Exception ignored) {}
        if (recordedPlayer == player) recordedPlayer = null;
    }

    private synchronized void stopInternal(boolean keepCompletedState) {
        if (!keepCompletedState) completed = true;
        if (signalPlayer != null) {
            try { if (signalPlayer.isPlaying()) signalPlayer.stop(); } catch (Exception ignored) {}
            try { signalPlayer.release(); } catch (Exception ignored) {}
            signalPlayer = null;
        }
        if (recordedPlayer != null) {
            try { if (recordedPlayer.isPlaying()) recordedPlayer.stop(); } catch (Exception ignored) {}
            try { recordedPlayer.release(); } catch (Exception ignored) {}
            recordedPlayer = null;
        }
        if (textToSpeech != null) {
            try { textToSpeech.stop(); } catch (Exception ignored) {}
            try { textToSpeech.shutdown(); } catch (Exception ignored) {}
            textToSpeech = null;
        }
        restoreAlarmVolume();
        if (!keepCompletedState) activeListener = null;
    }

    private void applyAlarmVolume(float requested) {
        if (audioManager == null) return;
        try {
            int maximum = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            int minimum = android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P
                ? audioManager.getStreamMinVolume(AudioManager.STREAM_ALARM)
                : 0;
            if (previousAlarmVolume < 0) {
                previousAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
            }
            int target = Math.max(minimum, Math.min(maximum, Math.round(maximum * requested)));
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, target, 0);
        } catch (Exception error) {
            Log.w(TAG, "Could not set alarm volume", error);
        }
    }

    private void restoreAlarmVolume() {
        if (audioManager == null || previousAlarmVolume < 0) return;
        try {
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, previousAlarmVolume, 0);
        } catch (Exception error) {
            Log.w(TAG, "Could not restore alarm volume", error);
        } finally {
            previousAlarmVolume = -1;
        }
    }
}
