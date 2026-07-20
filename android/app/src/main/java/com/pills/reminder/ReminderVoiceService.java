package com.pills.reminder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.IBinder;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.util.Locale;

public class ReminderVoiceService extends Service {
    private static final String TAG = "ReminderVoiceService";
    private static final String CHANNEL_ID = "medicine-voice-service-v1";
    private static final int FOREGROUND_NOTIFICATION_ID = 719204;
    private TextToSpeech textToSpeech;

    @Override
    public void onCreate() {
        super.onCreate();
        createServiceChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String text = intent == null ? null : intent.getStringExtra("text");
        float rate = intent == null ? 0.72f : intent.getFloatExtra("rate", 0.72f);
        int requestCode = intent == null ? 0 : intent.getIntExtra("requestCode", 0);

        startForeground(
            FOREGROUND_NOTIFICATION_ID,
            buildForegroundNotification(text == null ? "Озвучиваем напоминание" : text)
        );

        if (text == null || text.trim().isEmpty()) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }

        stopSpeech();
        textToSpeech = new TextToSpeech(getApplicationContext(), status -> {
            if (status != TextToSpeech.SUCCESS || textToSpeech == null) {
                Log.e(TAG, "Background TTS initialization failed: " + status);
                stopSelf(startId);
                return;
            }

            int languageResult = textToSpeech.setLanguage(new Locale("ru", "RU"));
            if (languageResult == TextToSpeech.LANG_MISSING_DATA ||
                languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                Log.e(TAG, "Russian background TTS unavailable: " + languageResult);
                stopSpeech();
                stopSelf(startId);
                return;
            }

            textToSpeech.setSpeechRate(Math.max(0.5f, Math.min(1.2f, rate)));
            textToSpeech.setPitch(1.02f);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                textToSpeech.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                );
            }
            textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {
                    Log.i(TAG, "Background Russian voice started, requestCode=" + requestCode);
                }

                @Override
                public void onDone(String utteranceId) {
                    Log.i(TAG, "Background Russian voice completed, requestCode=" + requestCode);
                    stopSpeech();
                    stopSelf(startId);
                }

                @Override
                public void onError(String utteranceId) {
                    Log.e(TAG, "Background Russian voice failed, requestCode=" + requestCode);
                    stopSpeech();
                    stopSelf(startId);
                }

                @Override
                public void onError(String utteranceId, int errorCode) {
                    Log.e(TAG, "Background Russian voice failed, code=" + errorCode);
                    stopSpeech();
                    stopSelf(startId);
                }
            });
            textToSpeech.speak(
                text,
                TextToSpeech.QUEUE_FLUSH,
                null,
                "medicine-background-voice-" + requestCode
            );
        });

        return START_NOT_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopSpeech();
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
        channel.setDescription("Служебное уведомление во время голосовой озвучки лекарства");
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
