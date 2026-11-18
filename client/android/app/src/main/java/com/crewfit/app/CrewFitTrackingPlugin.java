package com.crewfit.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.Lifecycle;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;

@CapacitorPlugin(name = "CrewFitTracking", permissions = {
    @Permission(alias = "location", strings = {Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION}),
    @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public final class CrewFitTrackingPlugin extends Plugin {
    private final PendingTrackingStart<PluginCall> pending = new PendingTrackingStart<>();
    private void cancelPendingStart() {
        PluginCall cancelled = pending.cancel();
        if (cancelled != null) cancelled.reject("측정 시작을 취소했어요.", "START_CANCELLED");
    }
    @PluginMethod public void start(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                TrackingStore.get(getContext()).guard(call.getString("ownerId"));
                if (!visible()) { call.reject("앱 화면에서 측정을 시작해 주세요.", "APP_NOT_VISIBLE"); return; }
                if (!pending.begin(call)) { call.reject("위치 권한 확인을 완료해 주세요.", "START_PENDING"); return; }
                if (!precise()) { requestPermissionForAlias("location", call, "locationPermission"); return; }
                requestNotificationsOrBegin(call);
            } catch (RuntimeException exception) { pending.complete(call); reject(call, exception); }
        });
    }
    @PermissionCallback private void locationPermission(PluginCall call) {
        if (!pending.owns(call)) return;
        if (!precise()) { pending.complete(call); call.reject("GPS 측정에는 정확한 위치 권한이 필요해요.", "LOCATION_PERMISSION_DENIED"); return; }
        getActivity().runOnUiThread(() -> requestNotificationsOrBegin(call));
    }
    private void requestNotificationsOrBegin(PluginCall call) {
        if (!pending.owns(call)) return;
        if (android.os.Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermission");
        } else ready(call);
    }
    @PermissionCallback private void notificationPermission(PluginCall call) {
        // Android allows the location FGS even when drawer notifications are denied.
        getActivity().runOnUiThread(() -> ready(call));
    }
    private void ready(PluginCall call) {
        if (!pending.ready(call)) return;
        if (visible()) begin(call);
    }
    @Override protected void handleOnResume() {
        // Permission results can arrive before the Activity is RESUMED.
        getActivity().getWindow().getDecorView().post(() -> {
            if (pending.readyCall() != null && visible()) begin(pending.readyCall());
        });
    }
    @Override protected void handleOnDestroy() { cancelPendingStart(); }
    private boolean precise() { return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED; }
    private boolean visible() { return getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED); }
    private void begin(PluginCall call) {
        if (!pending.owns(call)) return;
        try {
            if (!visible()) { call.reject("앱 화면에서 측정을 시작해 주세요.", "APP_NOT_VISIBLE"); return; }
            TrackingStore store = TrackingStore.get(getContext());
            boolean created = store.begin(call.getString("ownerId"), call.getString("sessionId"), call.getString("sport"));
            if (created) {
                try { ContextCompat.startForegroundService(getContext(), new Intent(getContext(), TrackingService.class).putExtra("sessionId", store.sessionId())); }
                catch (RuntimeException exception) { store.finish("위치 측정 서비스를 시작하지 못했어요. 다시 시도해 주세요."); }
            }
            call.resolve(withNotificationState(store.snapshot(call.getString("ownerId"))));
        } catch (RuntimeException exception) { reject(call, exception); }
        finally { pending.complete(call); }
    }
    @PluginMethod public void snapshot(PluginCall call) { execute(call, "snapshot"); }
    @PluginMethod public void stop(PluginCall call) { execute(call, "stop"); }
    @PluginMethod public void clear(PluginCall call) { execute(call, "clear"); }
    @PluginMethod public void suspend(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            cancelPendingStart();
            try {
                try { TrackingStore.get(getContext()).finish("로그인이 종료되어 GPS 측정을 멈췄어요. 같은 계정으로 로그인해 기록을 확인해 주세요."); }
                finally { getContext().stopService(new Intent(getContext(), TrackingService.class)); }
                call.resolve(new JSObject().put("ok", true));
            } catch (RuntimeException exception) { reject(call, exception); }
        });
    }
    private void execute(PluginCall call, String operation) {
        getActivity().runOnUiThread(() -> {
            try {
                TrackingStore store = TrackingStore.get(getContext());
                String owner = call.getString("ownerId");
                try { store.guard(owner); }
                catch (IllegalStateException exception) {
                    if ("snapshot".equals(operation) && "OWNER_MISMATCH".equals(exception.getMessage())) {
                        cancelPendingStart();
                        try { store.finish("계정이 변경되어 측정을 종료했어요. 이전 계정으로 로그인해 기록을 확인해 주세요."); }
                        catch (RuntimeException ignored) { /* Keep the last private checkpoint. */ }
                        finally { getContext().stopService(new Intent(getContext(), TrackingService.class)); }
                    }
                    throw exception;
                }
                if ("stop".equals(operation)) {
                    cancelPendingStart();
                    try { store.finish("측정을 종료했어요. 기록을 저장해 주세요."); }
                    finally { getContext().stopService(new Intent(getContext(), TrackingService.class)); }
                } else if ("clear".equals(operation)) store.clear(owner, call.getString("sessionId"));
                call.resolve(withNotificationState(store.snapshot(owner, "snapshot".equals(operation) && Boolean.TRUE.equals(call.getBoolean("summaryOnly", false)))));
            } catch (RuntimeException exception) { reject(call, exception); }
        });
    }
    private JSObject withNotificationState(JSObject state) {
        return state.put("notificationsEnabled", androidx.core.app.NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
    }
    private void reject(PluginCall call, RuntimeException exception) {
        String code = exception instanceof IllegalStateException ? exception.getMessage() : "TRACKING_ERROR";
        call.reject("GPS 기록을 처리하지 못했어요. 현재 계정과 남아 있는 기록을 확인해 주세요.", code);
    }
}
