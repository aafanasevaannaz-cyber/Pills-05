package com.pills.reminder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.File;
import java.lang.ref.WeakReference;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;

public class ReminderVoiceService extends Service {
    private static final String TAG = "ReminderVoiceService";
    private static final String CHANNEL_ID = "medicine-voice-service-v3";
    private static final int FOREGROUND_NOTIFICATION_ID = 719204;
    private static final AtomicInteger AUDIO_GENERATION = new AtomicInteger(0);
    private static WeakReference<ReminderVoiceService> activeService = new WeakReference<>(null);

    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextToSpeech textToSpeech;
    private MediaPlayer mediaPlayer;
    private AudioManager audioManager;
    private int previousAlarmVolume = -1;
    private int activeGeneration = 0;

    /**
     * Немедленно инвалидирует все отложенные запуски голоса, затем останавливает
     * живую службу. Возвращаемое поколение используется в диагностике.
     */
    public static int stopAllActive(Context context) {
        int generation = AUDIO_GENERATION.incrementAndGet();
        ReminderVoiceService service = activeService.get();
        if (service != null) {
            service.handler.post(() -> service.stopImmediately("external stop", generation));
        } else {
            try {
                context.stopService(new Intent(context, ReminderVoiceService.class));
            } catch (Exception error) {
                Log.w(TAG, "Fallback stopService failed", error);
            }
        }
        Log.i(TAG, "Reminder audio cancellation requested, generation=" + generation);
        return generation;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        activeService = new WeakReference<>(this);
        createServiceChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        final int runGeneration = AUDIO_GENERATION.incrementAndGet();
        activeGeneration = runGeneration;

        String text = intent == null ? "" : intent.getStringExtra("text");
        float rate = intent == null ? 0.72f : intent.getFloatExtra("rate", 0.72f);
        String voiceMode = intent == null ? "android" : intent.getStringExtra("voiceMode");
        float voiceVolume = intent == null ? 1f : intent.getFloatExtra("voiceVolume", 1f);
        float alarmVolume = intent == null ? 1f : intent.getFloatExtra("alarmVolume", 1f);
        int delayBeforeVoiceMs = intent == null ? 4000 : intent.getIntExtra("delayBeforeVoiceMs", 4000);
        String recordedVoicePath = intent == null ? "" : intent.getStringExtra("recordedVoicePath");
        int requestCode = intent == null ? 0 : intent.getIntExtra("requestCode", 0);

        stopCurrentAudio(false);
        applyAlarmVolume(alarmVolume);
        startForeground(
            FOREGROUND_NOTIFICATION_ID,
            buildForegroundNotification(text == null || text.isEmpty() ? "Звуковое напоминание" : text)
        );

        String safeMode = voiceMode == null ? "android" : voiceMode;
        String safeText = text == null ? "" : text;
        String safePath = recordedVoicePath == null ? "" : recordedVoicePath;
        float safeRate = Math.max(0.5f, Math.min(1.2f, rate));
        float safeVoiceVolume = Math.max(0.05f, Math.min(1f, voiceVolume));
        int safeDelay = Math.max(0, delayBeforeVoiceMs);

        handler.postDelayed(() -> {
            if (!isGenerationActive(runGeneration)) {
                Log.i(TAG, "Delayed voice cancelled before start, generation=" + runGeneration);
                return;
            }
            if ("off".equals(safeMode)) {
                Log.i(TAG, "Reminder has no voice, requestCode=" + requestCode);
                finishReminder(startId, runGeneration);
                return;
            }

            if ("recorded".equals(safeMode) && !safePath.isEmpty()) {
                playRecordedVoice(safePath, safeVoiceVolume, requestCode, startId, runGeneration);
                return;
            }

            speakAndroidVoice(safeText, safeRate, safeVoiceVolume, requestCode, startId, runGeneration);
        }, safeDelay);

        Log.i(
            TAG,
            "Reminder audio service started, requestCode=" + requestCode +
                ", alarmVolume=" + alarmVolume +
                ", voiceMode=" + safeMode +
                ", voiceVolume=" + safeVoiceVolume +
                ", generation=" + runGeneration
        );
        return START_NOT_STICKY;
    }

    private boolean isGenerationActive(int generation) {
        return generation == activeGeneration && generation == AUDIO_GENERATION.get();
    }

    private void applyAlarmVolume(float requestedLevel) {
        if (audioManager == null) return;
        try {
            int maximum = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            int minimum = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? audioManager.getStreamMinVolume(AudioManager.STREAM_ALARM)
                : 0;
            if (previousAlarmVolume < 0) {
                previousAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
            }
            float level = Math.max(0.05f, Math.min(1f, requestedLevel));
            int target = Math.max(minimum, Math.min(maximum, Math.round(maximum * level)));
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, target, 0);
            Log.i(TAG, "Alarm stream temporarily set to " + target + "/" + maximum);
        } catch (Exception error) {
            Log.w(TAG, "Could not set alarm stream volume", error);
        }
    }

    private void restoreAlarmVolume() {
        if (audioManager == null || previousAlarmVolume < 0) return;
        try {
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, previousAlarmVolume, 0);
            Log.i(TAG, "Alarm stream restored to " + previousAlarmVolume);
        } catch (Exception error) {
            Log.w(TAG, "Could not restore alarm stream volume", error);
        } finally {
            previousAlarmVolume = -1;
        }
    }

    private void playRecordedVoice(
        String path,
        float volume,
        int requestCode,
        int startId,
        int generation
    ) {
        if (!isGenerationActive(generation)) return;
        File file = new File(path);
        if (!file.exists() || file.length() == 0) {
            Log.e(TAG, "Recorded reminder voice is missing, requestCode=" + requestCode);
            finishReminder(startId, generation);
            return;
        }

        try {
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            );
            mediaPlayer.setDataSource(file.getAbsolutePath());
            mediaPlayer.setVolume(volume, volume);
            mediaPlayer.setOnCompletionListener(player -> {
                Log.i(TAG, "Recorded reminder voice completed, requestCode=" + requestCode);
                player.release();
                if (mediaPlayer == player) mediaPlayer = null;
                finishReminder(startId, generation);
            });
            mediaPlayer.setOnErrorListener((player, what, extra) -> {
                Log.e(TAG, "Recorded reminder voice failed, what=" + what + ", extra=" + extra);
                player.release();
                if (mediaPlayer == player) mediaPlayer = null;
                finishReminder(startId, generation);
                return true;
            });
            mediaPlayer.prepare();
            if (!isGenerationActive(generation)) {
                mediaPlayer.release();
                mediaPlayer = null;
                return;
            }
            mediaPlayer.start();
            Log.i(TAG, "Recorded reminder voice started, requestCode=" + requestCode + ", volume=" + volume);
        } catch (Exception error) {
            Log.e(TAG, "Could not play recorded reminder voice", error);
            finishReminder(startId, generation);
        }
    }

    private void speakAndroidVoice(
        String text,
        float rate,
        float volume,
        int requestCode,
        int startId,
        int generation
    ) {
        if (!isGenerationActive(generation) || text == null || text.trim().isEmpty()) {
            finishReminder(startId, generation);
            return;
        }

        stopSpeech();
        textToSpeech = new TextToSpeech(getApplicationContext(), status -> {
            if (!isGenerationActive(generation)) {
                Log.i(TAG, "TTS initialization cancelled, generation=" + generation);
                stopSpeech();
                return;
            }
            if (status != TextToSpeech.SUCCESS || textToSpeech == null) {
                Log.e(TAG, "Background TTS initialization failed: " + status);
                finishReminder(startId, generation);
                return;
            }

            int languageResult = textToSpeech.setLanguage(new Locale("ru", "RU"));
            if (languageResult == TextToSpeech.LANG_MISSING_DATA ||
                languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                Log.e(TAG, "Russian background TTS unavailable: " + languageResult);
                finishReminder(startId, generation);
                return;
            }

            textToSpeech.setSpeechRate(rate);
            textToSpeech.setPitch(1.02f);
            textToSpeech.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            );
            textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {
                    Log.i(TAG, "Background Russian voice started, requestCode=" + requestCode + ", volume=" + volume);
                }

                @Override
                public void onDone(String utteranceId) {
                    Log.i(TAG, "Background Russian voice completed, requestCode=" + requestCode);
                    finishReminder(startId, generation);
                }

                @Override
                public void onError(String utteranceId) {
                    Log.e(TAG, "Background Russian voice failed, requestCode=" + requestCode);
                    finishReminder(startId, generation);
                }

                @Override
                public void onError(String utteranceId, int errorCode) {
                    Log.e(TAG, "Background Russian voice failed, code=" + errorCode);
                    finishReminder(startId, generation);
                }
            });

            if (!isGenerationActive(generation)) {
                stopSpeech();
                return;
            }
            Bundle parameters = new Bundle();
            parameters.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume);
            textToSpeech.speak(
                text,
                TextToSpeech.QUEUE_FLUSH,
                parameters,
                "medicine-background-voice-" + requestCode
            );
        });
    }

    private void finishReminder(int startId, int generation) {
        handler.post(() -> {
            if (!isGenerationActive(generation)) return;
            stopCurrentAudio(true);
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf(startId);
        });
    }

    private void stopImmediately(String reason, int generation) {
        activeGeneration = generation;
        handler.removeCallbacksAndMessages(null);
        stopCurrentAudio(true);
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
        Log.i(TAG, "Reminder audio stopped immediately: " + reason + ", generation=" + generation);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        stopCurrentAudio(true);
        ReminderVoiceService current = activeService.get();
        if (current == this) activeService.clear();
        Log.i(TAG, "Reminder audio service destroyed, generation=" + activeGeneration);
        super.onDestroy();
    }

    private void createServiceChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Голос лекарства",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Служебное уведомление во время озвучки лекарства");
        channel.setSound(null, null);
        channel.enableVibration(false);
        manager.createNotificationChannel(channel);
    }

    private Notification buildForegroundNotification(String text) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Пора принять лекарство")
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .setOngoing(false)
            .build();
    }

    private void stopCurrentAudio(boolean restoreVolume) {
        handler.removeCallbacksAndMessages(null);
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
            } catch (Exception ignored) {
            }
            try {
                mediaPlayer.release();
            } catch (Exception ignored) {
            }
            mediaPlayer = null;
        }
        stopSpeech();
        if (restoreVolume) restoreAlarmVolume();
    }

    private void stopSpeech() {
        if (textToSpeech == null) return;
        try {
            textToSpeech.stop();
            textToSpeech.shutdown();
        } catch (Exception ignored) {
        }
        textToSpeech = null;
    }
}
