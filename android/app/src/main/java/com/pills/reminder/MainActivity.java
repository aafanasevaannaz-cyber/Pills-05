package com.pills.reminder;

import android.media.AudioManager;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ReminderAudioPlugin.class);
        registerPlugin(ReminderStopPlugin.class);
        super.onCreate(savedInstanceState);
        setVolumeControlStream(AudioManager.STREAM_ALARM);
    }
}
