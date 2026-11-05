package com.techsquad.silentcall;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * CovertBackgroundService
 * 
 * Persistent Foreground Service engineered for Xiaomi HyperOS / Android 14.
 * 1. Keeps CPU active via PARTIAL_WAKE_LOCK so timers never freeze.
 * 2. Hardware Accelerometer Shake Listener: Detects 3 vigorous physical shakes
 *    directly on the physical phone in the background and dispatches silent SOS.
 * 3. Disguised ongoing notification keeps Android Low-Memory Killer away.
 */
public class CovertBackgroundService extends Service implements SensorEventListener {
    public static final String CHANNEL_ID = "silentcall_engine_channel";
    public static final int NOTIFICATION_ID = 10112;
    private PowerManager.WakeLock wakeLock;

    // Hardware Sensor Management
    private SensorManager sensorManager;
    private Sensor accelerometer;
    private long lastShakeTimestamp = 0;
    private int shakeCount = 0;
    private static final float SHAKE_THRESHOLD_G = 2.4f; // ~2.4G physical acceleration
    private static final int SHAKE_WINDOW_MS = 1500;
    private static final int SHAKE_MIN_INTERVAL_MS = 250;
    private long lastShakeTime = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        acquirePartialWakeLock();
        initHardwareSensors();
    }

    private void initHardwareSensors() {
        try {
            sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
            if (sensorManager != null) {
                accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
                if (accelerometer != null) {
                    sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = createCovertNotification();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int serviceType = 0;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION | 
                              ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE | 
                              ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
            }
            try {
                startForeground(NOTIFICATION_ID, notification, serviceType);
            } catch (Exception e) {
                startForeground(NOTIFICATION_ID, notification);
            }
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        return START_STICKY;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            float x = event.values[0] / SensorManager.GRAVITY_EARTH;
            float y = event.values[1] / SensorManager.GRAVITY_EARTH;
            float z = event.values[2] / SensorManager.GRAVITY_EARTH;

            float gForce = (float) Math.sqrt(x * x + y * y + z * z);

            if (gForce > SHAKE_THRESHOLD_G) {
                long now = System.currentTimeMillis();

                if (lastShakeTime == 0 || (now - lastShakeTime) > SHAKE_MIN_INTERVAL_MS) {
                    lastShakeTime = now;

                    if ((now - lastShakeTimestamp) > SHAKE_WINDOW_MS) {
                        shakeCount = 1;
                        lastShakeTimestamp = now;
                    } else {
                        shakeCount++;
                        if (shakeCount >= 3) {
                            // 3 vigorous shakes within 1.5 seconds detected on physical phone!
                            triggerNativeShakeEmergency();
                            shakeCount = 0;
                            lastShakeTimestamp = 0;
                        }
                    }
                }
            }
        }
    }

    private void triggerNativeShakeEmergency() {
        // Discreet double haptic pulse so user feels confirmation in pocket
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createWaveform(new long[]{0, 80, 100, 80}, -1));
                } else {
                    v.vibrate(new long[]{0, 80, 100, 80}, -1);
                }
            }
        } catch (Exception ignored) {}

        // Dispatch background emergency packet via network
        new Thread(() -> {
            try {
                URL url = new URL("https://silentcall-sos.onrender.com/api/sos");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; utf-8");
                conn.setDoOutput(true);
                conn.setConnectTimeout(4000);
                conn.setReadTimeout(4000);

                String jsonPayload = "{"
                    + "\"triggerType\":\"HARDWARE_ACCELEROMETER_SHAKE\","
                    + "\"threatLevel\":\"CRITICAL\","
                    + "\"coordinates\":{\"latitude\":12.9246,\"longitude\":80.1271},"
                    + "\"telemetry\":{\"decibelLevel\":74,\"battery\":{\"level\":82,\"charging\":false}},"
                    + "\"notes\":\"Physical panic shake detected by phone hardware accelerometer\""
                    + "}";

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonPayload.getBytes("utf-8");
                    os.write(input, 0, input.length);
                }

                int responseCode = conn.getResponseCode();
                conn.disconnect();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    private void acquirePartialWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && (wakeLock == null || !wakeLock.isHeld())) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SilentCall:CovertWakeLock");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(12 * 60 * 60 * 1000L); // Max 12 hours safeguard
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void releasePartialWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Calculator Background Engine",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Maintains arithmetic computation engine and telemetry synchronization");
            channel.setShowBadge(false);
            channel.enableVibration(false);
            channel.setSound(null, null);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createCovertNotification() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Calculator")
            .setContentText("Calculation service running in background")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setSilent(true)
            .build();
    }

    @Override
    public void onDestroy() {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        releasePartialWakeLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
