package com.pills.reminder;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.IOException;
import java.util.Locale;

@CapacitorPlugin(
    name = "ReminderAudio",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class ReminderAudioPlugin extends Plugin {
    private static final String TAG = "ReminderAudio";
    private MediaPlayer mediaPlayer;
    private TextToSpeech textToSpeech;
    private MediaRecorder mediaRecorder;
    private File recordingFile;
    private long recordingStartedAt;

    private AudioAttributes alarmAttributes(int contentType) {
        return new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(contentType)
            .build();
    }

    private float clampVolume(double value) {
        return (float) Math.max(0.05, Math.min(1, value));
    }

    private void setAlarmStreamVolume(double requestedLevel) {
        try {
            AudioManager manager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (manager == null) return;
            int maximum = manager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            int minimum = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? manager.getStreamMinVolume(AudioManager.STREAM_ALARM)
                : 0;
            int target = Math.max(minimum, Math.min(maximum, Math.round(maximum * clampVolume(requestedLevel))));
            manager.setStreamVolume(AudioManager.STREAM_ALARM, target, 0);
            Log.i(TAG, "Alarm stream volume set to " + target + "/" + maximum);
        } catch (Exception error) {
            Log.w(TAG, "Could not adjust alarm stream volume", error);
        }
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
        setAlarmStreamVolume(call.getDouble("streamVolume", 1.0));
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

            float volume = clampVolume(call.getDouble("volume", 1.0));
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
        float rate = (float) Math.max(0.5, Math.min(1.2, call.getDouble("rate", 0.9)));
        float volume = clampVolume(call.getDouble("volume", 1.0));
        setAlarmStreamVolume(call.getDouble("streamVolume", 1.0));

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
            Bundle parameters = new Bundle();
            parameters.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume);
            textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, parameters, "medicine-reminder-preview");
            Log.i(TAG, "Russian alarm-stream voice started, rate=" + rate + ", volume=" + volume + ", text=" + text);

            JSObject result = new JSObject();
            result.put("speaking", true);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void startVoiceRecording(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }
        startVoiceRecordingInternal(call);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Без разрешения на микрофон записать свой голос нельзя");
            return;
        }
        startVoiceRecordingInternal(call);
    }

    private void startVoiceRecordingInternal(PluginCall call) {
        if (mediaRecorder != null) {
            call.reject("Запись уже идёт");
            return;
        }

        String key = call.getString("key", "medicine");
        String safeKey = key == null ? "medicine" : key.replaceAll("[^a-zA-Z0-9_-]", "_");
        File directory = voiceDirectory();
        if (!directory.exists() && !directory.mkdirs()) {
            call.reject("Не удалось создать папку для записи");
            return;
        }

        recordingFile = new File(directory, "voice_" + safeKey + "_" + System.currentTimeMillis() + ".m4a");
        try {
            mediaRecorder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? new MediaRecorder(getContext())
                : new MediaRecorder();
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mediaRecorder.setAudioSamplingRate(44_100);
            mediaRecorder.setAudioEncodingBitRate(128_000);
            mediaRecorder.setOutputFile(recordingFile.getAbsolutePath());
            mediaRecorder.prepare();
            mediaRecorder.start();
            recordingStartedAt = SystemClock.elapsedRealtime();

            JSObject result = new JSObject();
            result.put("recording", true);
            call.resolve(result);
            Log.i(TAG, "Custom reminder voice recording started");
        } catch (Exception error) {
            Log.e(TAG, "Could not start custom voice recording", error);
            cancelRecorder(true);
            call.reject("Не удалось начать запись голоса", error);
        }
    }

    @PluginMethod
    public void stopVoiceRecording(PluginCall call) {
        if (mediaRecorder == null || recordingFile == null) {
            call.reject("Запись не запущена");
            return;
        }

        long duration = Math.max(0, SystemClock.elapsedRealtime() - recordingStartedAt);
        File completedFile = recordingFile;
        try {
            mediaRecorder.stop();
            mediaRecorder.release();
            mediaRecorder = null;
            recordingFile = null;
            recordingStartedAt = 0;

            if (duration < 500 || !completedFile.exists() || completedFile.length() < 1024) {
                completedFile.delete();
                call.reject("Запись слишком короткая. Запишите хотя бы одну секунду");
                return;
            }

            JSObject result = new JSObject();
            result.put("path", completedFile.getAbsolutePath());
            result.put("durationMs", duration);
            call.resolve(result);
            Log.i(TAG, "Custom reminder voice recording saved, durationMs=" + duration);
        } catch (RuntimeException error) {
            Log.e(TAG, "Could not finish custom voice recording", error);
            cancelRecorder(true);
            call.reject("Запись не сохранилась. Попробуйте ещё раз", error);
        }
    }

    @PluginMethod
    public void cancelVoiceRecording(PluginCall call) {
        cancelRecorder(true);
        call.resolve();
    }

    @PluginMethod
    public void playRecordedVoice(PluginCall call) {
        String path = call.getString("path", "");
        try {
            File file = validatedVoiceFile(path);
            if (!file.exists() || file.length() == 0) {
                call.reject("Запись голоса не найдена");
                return;
            }

            stopPlayer();
            setAlarmStreamVolume(call.getDouble("streamVolume", 1.0));
            MediaPlayer player = new MediaPlayer();
            player.setAudioAttributes(alarmAttributes(AudioAttributes.CONTENT_TYPE_SPEECH));
            player.setDataSource(file.getAbsolutePath());
            float volume = clampVolume(call.getDouble("volume", 1.0));
            player.setVolume(volume, volume);
            player.setOnCompletionListener(completedPlayer -> {
                completedPlayer.release();
                if (mediaPlayer == completedPlayer) mediaPlayer = null;
                Log.i(TAG, "Custom reminder voice preview completed");
            });
            player.prepare();
            player.start();
            mediaPlayer = player;

            JSObject result = new JSObject();
            result.put("playing", true);
            call.resolve(result);
            Log.i(TAG, "Custom reminder voice preview started, volume=" + volume);
        } catch (Exception error) {
            Log.e(TAG, "Could not play custom voice recording", error);
            stopPlayer();
            call.reject("Не удалось воспроизвести запись", error);
        }
    }

    @PluginMethod
    public void deleteVoiceRecording(PluginCall call) {
        String path = call.getString("path", "");
        try {
            File file = validatedVoiceFile(path);
            if (file.exists() && !file.delete()) {
                call.reject("Не удалось удалить запись");
                return;
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("Не удалось удалить запись", error);
        }
    }

    @PluginMethod
    public void ensureAlarmChannel(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();
            return;
        }

        String channelId = call.getString("channelId", "medicine-reminders-v8-alarm-maximum");
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
    public void scheduleVoiceAlarm(PluginCall call) {
        int requestCode = call.getInt("requestCode", 0);
        String medicineId = call.getString("medicineId", "");
        long triggerAt = Math.round(call.getDouble("triggerAt", (double) System.currentTimeMillis()));
        int repeatDays = call.getInt("repeatDays", 0);
        String text = call.getString("text", "Пора принять лекарство");
        float rate = (float) Math.max(0.5, Math.min(1.2, call.getDouble("rate", 0.72)));
        String voiceMode = call.getString("voiceMode", "android");
        float voiceVolume = clampVolume(call.getDouble("voiceVolume", 1.0));
        float alarmVolume = clampVolume(call.getDouble("alarmVolume", 1.0));
        int delayBeforeVoiceMs = Math.max(0, call.getInt("delayBeforeVoiceMs", 4000));
        String recordedVoicePath = call.getString("recordedVoicePath", "");

        if (requestCode <= 0) {
            call.reject("Неверные параметры напоминания");
            return;
        }

        if ("recorded".equals(voiceMode)) {
            try {
                File recorded = validatedVoiceFile(recordedVoicePath);
                if (!recorded.exists()) voiceMode = "android";
                else recordedVoicePath = recorded.getAbsolutePath();
            } catch (Exception ignored) {
                voiceMode = "android";
                recordedVoicePath = "";
            }
        }

        try {
            ReminderVoiceAlarmReceiver.schedule(
                getContext(),
                requestCode,
                medicineId == null ? "" : medicineId,
                triggerAt,
                Math.max(0, repeatDays),
                text == null ? "" : text,
                rate,
                voiceMode == null ? "android" : voiceMode,
                voiceVolume,
                alarmVolume,
                delayBeforeVoiceMs,
                recordedVoicePath == null ? "" : recordedVoicePath
            );
            call.resolve();
        } catch (Exception error) {
            Log.e(TAG, "Could not schedule background reminder audio", error);
            call.reject("Не удалось запланировать звуковое напоминание", error);
        }
    }

    @PluginMethod
    public void cancelVoiceAlarmsForMedicine(PluginCall call) {
        String medicineId = call.getString("medicineId", "");
        try {
            ReminderVoiceAlarmReceiver.cancelForMedicine(
                getContext(),
                medicineId == null ? "" : medicineId
            );
            call.resolve();
        } catch (Exception error) {
            Log.e(TAG, "Could not cancel medicine voice alarms", error);
            call.reject("Не удалось отменить голосовые напоминания", error);
        }
    }

    @PluginMethod
    public void cancelAllVoiceAlarms(PluginCall call) {
        try {
            ReminderVoiceAlarmReceiver.cancelAll(getContext());
            call.resolve();
        } catch (Exception error) {
            Log.e(TAG, "Could not cancel all voice alarms", error);
            call.reject("Не удалось отменить голосовые напоминания", error);
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
        String channelId = call.getString("channelId", "medicine-reminders-v8-alarm-maximum");
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

    private File voiceDirectory() {
        return new File(getContext().getFilesDir(), "voice_reminders");
    }

    private File validatedVoiceFile(String path) throws IOException {
        if (path == null || path.trim().isEmpty()) throw new IOException("Empty recording path");
        File directory = voiceDirectory().getCanonicalFile();
        File file = new File(path).getCanonicalFile();
        String prefix = directory.getPath() + File.separator;
        if (!file.getPath().startsWith(prefix)) throw new IOException("Recording path is outside app storage");
        return file;
    }

    private void cancelRecorder(boolean deleteFile) {
        if (mediaRecorder != null) {
            try {
                mediaRecorder.stop();
            } catch (Exception ignored) {
            }
            try {
                mediaRecorder.release();
            } catch (Exception ignored) {
            }
            mediaRecorder = null;
        }
        if (deleteFile && recordingFile != null && recordingFile.exists()) recordingFile.delete();
        recordingFile = null;
        recordingStartedAt = 0;
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
        cancelRecorder(true);
        super.handleOnDestroy();
    }
}
