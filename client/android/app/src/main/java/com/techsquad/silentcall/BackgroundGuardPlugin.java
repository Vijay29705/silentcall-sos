package com.techsquad.silentcall;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundGuard")
public class BackgroundGuardPlugin extends Plugin {

    @PluginMethod
    public void startForegroundService(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent intent = new Intent(ctx, CovertBackgroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }
            JSObject res = new JSObject();
            res.put("success", true);
            res.put("status", "SERVICE_STARTED");
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to start covert foreground service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopForegroundService(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent intent = new Intent(ctx, CovertBackgroundService.class);
            ctx.stopService(intent);
            JSObject res = new JSObject();
            res.put("success", true);
            res.put("status", "SERVICE_STOPPED");
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to stop covert foreground service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void requestBatteryOptimizationExemption(PluginCall call) {
        try {
            Context ctx = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
                String packageName = ctx.getPackageName();
                boolean isIgnoring = pm != null && pm.isIgnoringBatteryOptimizations(packageName);

                if (!isIgnoring) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + packageName));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(intent);
                }

                JSObject res = new JSObject();
                res.put("alreadyExempt", isIgnoring);
                call.resolve(res);
            } else {
                JSObject res = new JSObject();
                res.put("alreadyExempt", true);
                call.resolve(res);
            }
        } catch (Exception e) {
            call.reject("Failed to request battery exemption: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        Context ctx = getContext();
        boolean handled = false;
        
        // Target Xiaomi / HyperOS / MIUI Security Center Autostart screen
        Intent[] miuiIntents = new Intent[] {
            new Intent().setClassName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
            new Intent().setClassName("com.miui.securitycenter", "com.miui.powercenter.PowerSettings"),
            new Intent().setClassName("com.miui.cleanmaster", "com.miui.securityscan.MainActivity")
        };

        for (Intent intent : miuiIntents) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
                handled = true;
                break;
            } catch (Exception ignored) {}
        }

        if (!handled) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.parse("package:" + ctx.getPackageName()));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(fallback);
                handled = true;
            } catch (Exception e) {
                call.reject("Unable to open settings: " + e.getMessage());
                return;
            }
        }

        JSObject res = new JSObject();
        res.put("launched", handled);
        call.resolve(res);
    }

    @PluginMethod
    public void checkOverlayPermission(PluginCall call) {
        boolean canDraw = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            canDraw = Settings.canDrawOverlays(getContext());
        }
        JSObject res = new JSObject();
        res.put("granted", canDraw);
        call.resolve(res);
    }

    @PluginMethod
    public void goToHomeScreen(PluginCall call) {
        try {
            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
            homeIntent.addCategory(Intent.CATEGORY_HOME);
            homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
            getContext().startActivity(homeIntent);

            if (getActivity() != null) {
                getActivity().moveTaskToBack(true);
            }

            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            try {
                if (getActivity() != null) {
                    getActivity().moveTaskToBack(true);
                }
            } catch (Exception ignored) {}
            call.resolve();
        }
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
                Intent intent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            JSObject res = new JSObject();
            res.put("prompted", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to open overlay permission settings: " + e.getMessage(), e);
        }
    }
}

