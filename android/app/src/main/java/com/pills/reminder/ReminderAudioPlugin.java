package com.pills.reminder;

import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;

@CapacitorPlugin(name = "ReminderAudio")
public class ReminderAudioPlugin extends Plugin {
    private MediaPlayer mediaPlayer;
    private TextToSpeech textToSpeech;

    @PluginMethod
    public void playSound(PluginCall call) {
        String requestedResource = call.getString("resource", "medicine_clear.wav");
        String resourceName = requestedResource == null
            ? "medicine_clear"
            : requestedResource.replace(".wav", "").replace(".mp3", "");
        int resourceId = getContext().getResources().getIdentifier(
            resourceName,
            "raw",
            getContext().getPackageName()
        );

        if (resourceId == 0) {
            call.reject("Звуковой файл не найден: " + resourceName);
            return;
        }

        stopPlayer();
        try {
            AssetFileDescriptor descriptor = getContext().getResources().openRawResourceFd(resourceId);
            MediaPlayer player = new MediaPlayer();
            player.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            );
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
                completedPlayer.release();
                if (mediaPlayer == completedPlayer) mediaPlayer = null;
            });
            player.prepare();
            player.start();
            mediaPlayer = player;

            JSObject result = new JSObject();
            result.put("playing", true);
            result.put("resource", resourceName);
            call.resolve(result);
        } catch (Exception error) {
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
                call.reject("На устройстве недоступна голосовая озвучка");
                return;
            }

            int languageResult = textToSpeech.setLanguage(new Locale("ru", "RU"));
            if (languageResult == TextToSpeech.LANG_MISSING_DATA ||
                languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                stopSpeech();
                call.reject("На устройстве не установлен русский голос Android");
                return;
            }

            textToSpeech.setSpeechRate(rate);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                textToSpeech.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                );
                textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "medicine-reminder-preview");
            } else {
                textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null);
            }

            JSObject result = new JSObject();
            result.put("speaking", true);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopPlayer();
        stopSpeech();
        call.resolve();
    }

    @PluginMethod
    public void openNotificationChannelSettings(PluginCall call) {
        String channelId = call.getString("channelId", "medicine-reminders-v4-clear");
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
            call.resolve();
        } catch (Exception error) {
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
