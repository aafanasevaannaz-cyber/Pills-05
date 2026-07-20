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
    private static final String ACTION = "com.moi.tabletki.reminder.VOICE_ALARM";
    private static final String PREFS = "medicine_voice_alarms";
    private static final String KEY_PREFIX = "alarm_";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION.equals(intent.getAction())) return;

        int requestCode = intent.getIntExtra("requestCode", 0);
        String medicineId = intent.getStringExtra("medicineId");
        String text = intent.getStringExtra("text");
        float rate = intent.getFloatExtra("rate", 0.72f);
        int repeatDays = intent.getIntExtra("repeatDays", 0);
        long previousTriggerAt = intent.getLongExtra("triggerAt", System.currentTimeMillis());

        if (text == null || text.trim().isEmpty()) {
            Log.e(TAG, "Voice alarm has no text, requestCode=" + requestCode);
            return;
        }

        Intent serviceIntent = new Intent(context, ReminderVoiceService.class);
        serviceIntent.putExtra("text", text);
        serviceIntent.putExtra("rate", rate);
        serviceIntent.putExtra("requestCode", requestCode);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            Log.i(TAG, "Started background Russian voice, requestCode=" + requestCode);
        } catch (Exception error) {
            Log.e(TAG, "Could not start reminder voice service", error);
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
                medicineId == null ? "" : medicineId,
                next.getTimeInMillis(),
                repeatDays,
                text,
                rate
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
        String text,
        float rate
    ) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) throw new IllegalStateException("AlarmManager unavailable");

        Intent intent = createIntent(
            context,
            requestCode,
            medicineId,
            triggerAt,
            repeatDays,
            text,
            rate
        );
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
            Log.w(TAG, "Exact alarm permission missing; scheduled best-effort voice alarm");
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        } else {
            manager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        }

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_PREFIX + requestCode, medicineId)
            .apply();
        Log.i(TAG, "Scheduled voice alarm requestCode=" + requestCode + ", at=" + triggerAt);
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

    private static Intent createIntent(
        Context context,
        int requestCode,
        String medicineId,
        long triggerAt,
        int repeatDays,
        String text,
        float rate
    ) {
        Intent intent = new Intent(context, ReminderVoiceAlarmReceiver.class);
        intent.setAction(ACTION);
        intent.putExtra("requestCode", requestCode);
        intent.putExtra("medicineId", medicineId);
        intent.putExtra("triggerAt", triggerAt);
        intent.putExtra("repeatDays", repeatDays);
        intent.putExtra("text", text);
        intent.putExtra("rate", rate);
        return intent;
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
