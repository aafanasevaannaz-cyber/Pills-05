package com.pills.reminder;

import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ReminderStop")
public class ReminderStopPlugin extends Plugin {
    private static final String TAG = "ReminderStop";

    @PluginMethod
    public void stopAll(PluginCall call) {
        try {
            boolean serviceStopped = getContext().stopService(
                new Intent(getContext(), ReminderVoiceService.class)
            );
            JSObject result = new JSObject();
            result.put("stopped", serviceStopped);
            call.resolve(result);
            Log.i(TAG, "Stopped active background reminder audio service=" + serviceStopped);
        } catch (Exception error) {
            Log.e(TAG, "Could not stop active reminder audio", error);
            call.reject("Не удалось остановить звук напоминания", error);
        }
    }
}
