package com.pills.reminder;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;

@CapacitorPlugin(name = "ReminderAudio")
public class ReminderAudioPlugin extends Plugin {
    private static final String TAG = "ReminderAudio";
    private MediaPlayer mediaPlayer;
    private TextToSpeech textToSpeech;

    private AudioAttributes alarmAttributes(int contentType) {
        return new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(contentType)
            .build();
    }

    @PluginMethod
    public void playSound(PluginCall call) {
        String requestedResource = call.getString("resource", "medicine_alarm_maximum.wav");
        String resourceName = requestedResource == null
            ? "medicine_alarm_maximum"
            : requestedResource.replace(".wav", "").replace(".mp3", "");
        int resourceId = getContext().getResources().getIdentifier(
            resourceName,
            "raw",
            getContext().getPackageName()
        );

        if (resourceId == 0) {
            Log.e(TAG, "Sound resource missing: " + resourceName);
            call.reject("Звуковой файл не найден: " + resourceName);
            return;
        }

        stopPlayer();
        try {
            AssetFileDescriptor descriptor = getContext().getResources().openRawResourceFd(resourceId);
            MediaPlayer player = new MediaPlayer();
            player.setAudioAttributes(alarmAttributes(AudioAttributes.CONTENT_TYPE_SONIFICATION));
            player.setDataSource(
                descriptor.getFileDescriptor(),
                descriptor.getStartOffset(),
                descriptor.getLength()
            );
            descriptor.close();

            double requestedVolume = call.getDouble("volume", 1.0);
            float volume = (float) Math.max(0, Math.min(1, requestedVolume));
            player.setVolume(volume, volume);
            player.setOnCompletionListener(completedPlayer -> {
                Log.i(TAG, "Native alarm sound completed: " + resourceName);
                completedPlayer.release();
                if (mediaPlayer == completedPlayer) mediaPlayer = null;
            });
            player.prepare();
            player.start();
            mediaPlayer = player;
            Log.i(TAG, "Native alarm sound started: " + resourceName + ", volume=" + volume);

            JSObject result = new JSObject();
            result.put("playing", true);
            result.put("resource", resourceName);
            call.resolve(result);
        } catch (Exception error) {
            Log.e(TAG, "Native alarm sound failed: " + resourceName, error);
            stopPlayer();
            call.reject("Не удалось воспроизвести сигнал", error);
        }
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "Пора принять лекарство");
        double requestedRate = call.getDouble("rate", 0.9);
        float rate = (float) Math.max(0.5, Math.min(1.2, requestedRate));

        stopSpeech();
        textToSpeech = new TextToSpeech(getContext(), status -> {
            if (status != TextToSpeech.SUCCESS || textToSpeech == null) {
                Log.e(TAG, "TextToSpeech initialization failed: " + status);
                call.reject("На устройстве недоступна голосовая озвучка");
                return;
            }

            int languageResult = textToSpeech.setLanguage(new Locale("ru", "RU"));
            if (languageResult == TextToSpeech.LANG_MISSING_DATA ||
                languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                Log.e(TAG, "Russian TextToSpeech voice is unavailable: " + languageResult);
                stopSpeech();
                call.reject("На устройстве не установлен русский голос Android");
                return;
            }

            textToSpeech.setSpeechRate(rate);
            textToSpeech.setPitch(1.02f);
            textToSpeech.setAudioAttributes(alarmAttributes(AudioAttributes.CONTENT_TYPE_SPEECH));
            textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "medicine-reminder-preview");
            Log.i(TAG, "Russian alarm-stream voice started, rate=" + rate + ", text=" + text);

            JSObject result = new JSObject();
            result.put("speaking", true);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void ensureAlarmChannel(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();
            return;
        }

        String channelId = call.getString("channelId", "medicine-reminders-v7-alarm-maximum");
        String channelName = call.getString("channelName", "Громкие напоминания о лекарствах");
        String description = call.getString("description", "Напоминания о времени приёма лекарств");
        String requestedResource = call.getString("resource", "medicine_alarm_maximum.wav");
        String resourceName = requestedResource == null
            ? "medicine_alarm_maximum"
            : requestedResource.replace(".wav", "").replace(".mp3", "");

        int resourceId = getContext().getResources().getIdentifier(
            resourceName,
            "raw",
            getContext().getPackageName()
        );
        if (resourceId == 0) {
            call.reject("Не найден сигнал для системного уведомления: " + resourceName);
            return;
        }

        try {
            NotificationManager manager = (NotificationManager) getContext()
                .getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel existing = manager.getNotificationChannel(channelId);
            if (existing == null) {
                NotificationChannel channel = new NotificationChannel(
                    channelId,
                    channelName,
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription(description);
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[] { 0, 450, 180, 450, 180, 650 });
                channel.enableLights(true);
                Uri soundUri = Uri.parse(
                    "android.resource://" + getContext().getPackageName() + "/" + resourceId
                );
                channel.setSound(
                    soundUri,
                    alarmAttributes(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                );
                manager.createNotificationChannel(channel);
                Log.i(TAG, "Created alarm-stream notification channel=" + channelId);
            }
            call.resolve();
        } catch (Exception error) {
            Log.e(TAG, "Could not create alarm notification channel=" + channelId, error);
            call.reject("Не удалось создать громкий канал уведомлений", error);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopPlayer();
        stopSpeech();
        Log.i(TAG, "Native reminder preview stopped");
        call.resolve();
    }

    @PluginMethod
    public void openNotificationChannelSettings(PluginCall call) {
        String channelId = call.getString("channelId", "medicine-reminders-v7-alarm-maximum");
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
                intent.putExtra(Settings.EXTRA_CHANNEL_ID, channelId);
            } else {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra("app_package", getContext().getPackageName());
                intent.putExtra("app_uid", getContext().getApplicationInfo().uid);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            Log.i(TAG, "Opened Android notification settings for channel=" + channelId);
            call.resolve();
        } catch (Exception error) {
            Log.e(TAG, "Could not open notification settings for channel=" + channelId, error);
            call.reject("Не удалось открыть настройки уведомлений Android", error);
        }
    }

    private void stopPlayer() {
        if (mediaPlayer == null) return;
        try {
            if (mediaPlayer.isPlaying()) mediaPlayer.stop();
        } catch (Exception ignored) {
        }
        mediaPlayer.release();
        mediaPlayer = null;
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

    @Override
    protected void handleOnDestroy() {
        stopPlayer();
        stopSpeech();
        super.handleOnDestroy();
    }
}
