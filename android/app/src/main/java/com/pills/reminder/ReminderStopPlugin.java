package com.pills.reminder;

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
            int generation = ReminderVoiceService.stopAllActive(getContext());
            JSObject result = new JSObject();
            result.put("stopped", true);
            result.put("generation", generation);
            call.resolve(result);
            Log.i(TAG, "Stop requested for every reminder audio source, generation=" + generation);
        } catch (Exception error) {
            Log.e(TAG, "Could not stop active reminder audio", error);
            call.reject("Не удалось остановить звук напоминания", error);
        }
    }
}
