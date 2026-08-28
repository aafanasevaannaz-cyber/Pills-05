package com.pills.reminder;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.provider.MediaStore;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "BlisterPhoto")
public class BlisterPhotoPlugin extends Plugin {
    @PluginMethod
    public void takePhoto(PluginCall call) {
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("На устройстве не найдена камера.");
            return;
        }
        startActivityForResult(call, intent, "cameraResult");
    }

    @ActivityCallback
    private void cameraResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("uri", "");
            call.resolve(cancelled);
            return;
        }

        try {
            Bundle extras = result.getData().getExtras();
            Bitmap bitmap = extras == null ? null : (Bitmap) extras.get("data");
            if (bitmap == null) {
                call.reject("Камера не вернула фотографию.");
                return;
            }

            File directory = new File(getContext().getFilesDir(), "blister-photos");
            if (!directory.exists() && !directory.mkdirs()) {
                call.reject("Не удалось создать папку для фотографий.");
                return;
            }
            File target = new File(directory, "blister-" + System.currentTimeMillis() + ".jpg");
            try (FileOutputStream output = new FileOutputStream(target)) {
                if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 90, output)) {
                    call.reject("Не удалось сохранить фотографию.");
                    return;
                }
            }

            JSObject response = new JSObject();
            response.put("uri", "file://" + target.getAbsolutePath());
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Не удалось сохранить фотографию блистера.", error);
        }
    }
}
