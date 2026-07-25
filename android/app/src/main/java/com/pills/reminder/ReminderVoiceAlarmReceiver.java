package com.pills.reminder;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import java.util.Calendar;
import java.util.Map;

public class ReminderVoiceAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "ReminderVoiceAlarm";
    private static final String ACTION = "com.chaipodusham.pochasam.rebuild2.REMINDER_SEQUENCE";
    private static final String PREFS = "medicine_voice_alarms_v2";
    private static final String KEY_PREFIX = "alarm_";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION.equals(intent.getAction())) return;

        int requestCode = intent.getIntExtra("requestCode", 0);
        String medicineId = value(intent, "medicineId", "");
        int repeatDays = intent.getIntExtra("repeatDays", 0);
        long previousTriggerAt = intent.getLongExtra("triggerAt", System.currentTimeMillis());

        Intent serviceIntent = new Intent(context, ReminderVoiceService.class);
        copy(intent, serviceIntent, "soundResource");
        copy(intent, serviceIntent, "text");
        copy(intent, serviceIntent, "voiceMode");
        copy(intent, serviceIntent, "voiceName");
        copy(intent, serviceIntent, "recordedVoicePath");
        serviceIntent.putExtra("rate", intent.getFloatExtra("rate", 0.72f));
        serviceIntent.putExtra("pitch", intent.getFloatExtra("pitch", 1f));
        serviceIntent.putExtra("voiceVolume", intent.getFloatExtra("voiceVolume", 1f));
        serviceIntent.putExtra("alarmVolume", intent.getFloatExtra("alarmVolume", 1f));
        serviceIntent.putExtra("requestCode", requestCode);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            Log.i(TAG, "Started reminder sequence, requestCode=" + requestCode);
        } catch (Exception error) {
            Log.e(TAG, "Could not start reminder sequence", error);
        }

        if (repeatDays > 0) {
            Calendar next = Calendar.getInstance();
            next.setTimeInMillis(Math.max(previousTriggerAt, System.currentTimeMillis()));
            do {
                next.add(Calendar.DAY_OF_YEAR, repeatDays);
            } while (next.getTimeInMillis() <= System.currentTimeMillis());

            schedule(
                context,
                requestCode,
                medicineId,
                next.getTimeInMillis(),
                repeatDays,
                value(intent, "soundResource", "medicine_classic_maximum.wav"),
                value(intent, "text", "Пора принять лекарство"),
                intent.getFloatExtra("rate", 0.72f),
                intent.getFloatExtra("pitch", 1f),
                value(intent, "voiceMode", "android"),
                intent.getFloatExtra("voiceVolume", 1f),
                intent.getFloatExtra("alarmVolume", 1f),
                value(intent, "voiceName", ""),
                value(intent, "recordedVoicePath", "")
            );
        } else {
            removeStoredAlarm(context, requestCode);
        }
    }

    public static void schedule(
        Context context,
        int requestCode,
        String medicineId,
        long triggerAt,
        int repeatDays,
        String soundResource,
        String text,
        float rate,
        float pitch,
        String voiceMode,
        float voiceVolume,
        float alarmVolume,
        String voiceName,
        String recordedVoicePath
    ) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) throw new IllegalStateException("AlarmManager unavailable");

        Intent intent = new Intent(context, ReminderVoiceAlarmReceiver.class);
        intent.setAction(ACTION);
        intent.putExtra("requestCode", requestCode);
        intent.putExtra("medicineId", medicineId);
        intent.putExtra("triggerAt", triggerAt);
        intent.putExtra("repeatDays", repeatDays);
        intent.putExtra("soundResource", soundResource);
        intent.putExtra("text", text);
        intent.putExtra("rate", rate);
        intent.putExtra("pitch", pitch);
        intent.putExtra("voiceMode", voiceMode);
        intent.putExtra("voiceVolume", voiceVolume);
        intent.putExtra("alarmVolume", alarmVolume);
        intent.putExtra("voiceName", voiceName);
        intent.putExtra("recordedVoicePath", recordedVoicePath);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        } else {
            manager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        }

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_PREFIX + requestCode, medicineId)
            .apply();
    }

    public static void cancelForMedicine(Context context, String medicineId) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();
        for (Map.Entry<String, ?> entry : preferences.getAll().entrySet()) {
            if (!entry.getKey().startsWith(KEY_PREFIX)) continue;
            if (!medicineId.equals(String.valueOf(entry.getValue()))) continue;
            int requestCode = parseRequestCode(entry.getKey());
            if (requestCode != 0) cancelRequest(context, requestCode);
            editor.remove(entry.getKey());
        }
        editor.apply();
    }

    public static void cancelAll(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        for (String key : preferences.getAll().keySet()) {
            if (!key.startsWith(KEY_PREFIX)) continue;
            int requestCode = parseRequestCode(key);
            if (requestCode != 0) cancelRequest(context, requestCode);
        }
        preferences.edit().clear().apply();
    }

    private static String value(Intent intent, String key, String fallback) {
        String value = intent.getStringExtra(key);
        return value == null ? fallback : value;
    }

    private static void copy(Intent from, Intent to, String key) {
        to.putExtra(key, value(from, key, ""));
    }

    private static void cancelRequest(Context context, int requestCode) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        Intent intent = new Intent(context, ReminderVoiceAlarmReceiver.class);
        intent.setAction(ACTION);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (pendingIntent != null) {
            manager.cancel(pendingIntent);
            pendingIntent.cancel();
        }
    }

    private static void removeStoredAlarm(Context context, int requestCode) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_PREFIX + requestCode)
            .apply();
    }

    private static int parseRequestCode(String key) {
        try {
            return Integer.parseInt(key.substring(KEY_PREFIX.length()));
        } catch (Exception ignored) {
            return 0;
        }
    }
}
