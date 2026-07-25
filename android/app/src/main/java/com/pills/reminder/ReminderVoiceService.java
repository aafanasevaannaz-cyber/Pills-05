package com.pills.reminder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.lang.ref.WeakReference;
import java.util.concurrent.atomic.AtomicInteger;

public class ReminderVoiceService extends Service {
    private static final String TAG = "ReminderVoiceService";
    private static final String CHANNEL_ID = "medicine-sequence-service-v1";
    private static final String ACTION_STOP = "com.chaipodusham.pochasam.rebuild2.STOP_AUDIO";
    private static final int FOREGROUND_NOTIFICATION_ID = 719204;
    private static final AtomicInteger GENERATION = new AtomicInteger(0);
    private static WeakReference<ReminderVoiceService> activeService = new WeakReference<>(null);

    private ReminderSequencePlayer sequencePlayer;
    private int activeGeneration;

    public static int stopAllActive(Context context) {
        int generation = GENERATION.incrementAndGet();
        ReminderVoiceService service = activeService.get();
        if (service != null) {
            service.stopImmediately("external stop", generation);
        } else {
            try {
                context.stopService(new Intent(context, ReminderVoiceService.class));
            } catch (Exception error) {
                Log.w(TAG, "Fallback stopService failed", error);
            }
        }
        return generation;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sequencePlayer = new ReminderSequencePlayer(this);
        activeService = new WeakReference<>(this);
        createServiceChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopImmediately("notification action", GENERATION.incrementAndGet());
            return START_NOT_STICKY;
        }

        activeGeneration = GENERATION.incrementAndGet();
        final int runGeneration = activeGeneration;
        ReminderSequencePlayer.Spec spec = new ReminderSequencePlayer.Spec();
        spec.soundResource = value(intent, "soundResource", "medicine_classic_maximum.wav");
        spec.alarmVolume = floatValue(intent, "alarmVolume", 1f);
        spec.text = value(intent, "text", "Пора принять лекарство");
        spec.rate = floatValue(intent, "rate", 0.72f);
        spec.pitch = floatValue(intent, "pitch", 1f);
        spec.voiceMode = value(intent, "voiceMode", "android");
        spec.voiceVolume = floatValue(intent, "voiceVolume", 1f);
        spec.voiceName = value(intent, "voiceName", "");
        spec.recordedVoicePath = value(intent, "recordedVoicePath", "");
        int requestCode = intent == null ? 0 : intent.getIntExtra("requestCode", 0);

        startForeground(FOREGROUND_NOTIFICATION_ID, buildForegroundNotification(spec.text));
        sequencePlayer.play(spec, new ReminderSequencePlayer.Listener() {
            @Override public void onFinished() {
                finishRun(startId, runGeneration, "completed");
            }
            @Override public void onError(Exception error) {
                Log.e(TAG, "Reminder sequence failed, requestCode=" + requestCode, error);
                finishRun(startId, runGeneration, "error");
            }
        });
        Log.i(TAG, "Reminder sequence started, requestCode=" + requestCode + ", generation=" + runGeneration);
        return START_NOT_STICKY;
    }

    private String value(Intent intent, String key, String fallback) {
        if (intent == null) return fallback;
        String value = intent.getStringExtra(key);
        return value == null ? fallback : value;
    }

    private float floatValue(Intent intent, String key, float fallback) {
        return intent == null ? fallback : intent.getFloatExtra(key, fallback);
    }

    private void finishRun(int startId, int generation, String reason) {
        if (generation != activeGeneration || generation != GENERATION.get()) return;
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf(startId);
        Log.i(TAG, "Reminder sequence finished: " + reason + ", generation=" + generation);
    }

    private void stopImmediately(String reason, int generation) {
        activeGeneration = generation;
        if (sequencePlayer != null) sequencePlayer.stop();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
        Log.i(TAG, "Reminder sequence stopped: " + reason + ", generation=" + generation);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (sequencePlayer != null) sequencePlayer.stop();
        ReminderVoiceService current = activeService.get();
        if (current == this) activeService.clear();
        super.onDestroy();
    }

    private void createServiceChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Активное напоминание",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Показывается, пока звучит напоминание");
        channel.setSound(null, null);
        channel.enableVibration(false);
        manager.createNotificationChannel(channel);
    }

    private Notification buildForegroundNotification(String text) {
        Intent stopIntent = new Intent(this, ReminderVoiceService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPendingIntent = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? PendingIntent.getForegroundService(this, 8801, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
            : PendingIntent.getService(this, 8801, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Пора принять лекарство")
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .setOngoing(true)
            .addAction(0, "Остановить", stopPendingIntent)
            .build();
    }
}
