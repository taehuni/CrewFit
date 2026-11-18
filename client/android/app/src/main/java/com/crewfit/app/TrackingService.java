package com.crewfit.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.*;
import android.os.*;
import androidx.core.app.NotificationCompat;

/** User-started location foreground service; never restarted after process death. */
public final class TrackingService extends Service implements LocationListener {
    static final String STOP = "com.crewfit.app.TRACKING_STOP";
    private static final String CHANNEL = "crewfit_tracking";
    private static final int NOTIFICATION = 4201;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private LocationManager locations;
    private TrackingStore store;
    private boolean collecting;
    private String sessionId;
    private final Runnable heartbeat = new Runnable() {
        @Override public void run() {
            if (!collecting) return;
            if (!store.owns(sessionId)) { cleanup(); stopSelf(); return; }
            try {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    finish("정확한 위치 권한이 해제되어 측정을 종료했어요."); return;
                }
                if (!store.active()) { finish("측정을 종료했어요. 기록을 저장해 주세요."); return; }
                if (store.limitReached()) { finish("6시간 또는 경로 수집 한도에 도달해 종료했어요."); return; }
                store.checkpoint();
            } catch (RuntimeException exception) { finish("기기에 기록을 보관하지 못해 측정을 종료했어요."); return; }
            handler.postDelayed(this, 5000);
        }
    };
    @Override public void onCreate() {
        super.onCreate(); store = TrackingStore.get(this); locations = (LocationManager) getSystemService(LOCATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "GPS 운동 측정", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("화면이 꺼져 있어도 사용자가 시작한 운동 위치를 수집합니다.");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction()) && !store.owns(intent.getStringExtra("sessionId"))) {
            if (!collecting) stopSelf();
            return START_NOT_STICKY;
        }
        if (intent != null && !STOP.equals(intent.getAction()) && !store.owns(intent.getStringExtra("sessionId"))) {
            if (!collecting) stopSelf();
            return START_NOT_STICKY;
        }
        if (intent == null || STOP.equals(intent.getAction()) || !store.active()) {
            if (sessionId == null && intent != null) sessionId = intent.getStringExtra("sessionId");
            finish("측정을 종료했어요. 기록을 저장해 주세요."); return START_NOT_STICKY;
        }
        if (collecting && store.owns(sessionId)) return START_NOT_STICKY;
        cleanup();
        sessionId = intent.getStringExtra("sessionId");
        try {
            Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent content = PendingIntent.getActivity(this, 4201, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            PendingIntent stop = PendingIntent.getService(this, 4202, new Intent(this, TrackingService.class).setAction(STOP)
                .setData(android.net.Uri.parse("crewfit-tracking://stop/" + sessionId)).putExtra("sessionId", sessionId), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification notification = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("CrewFit GPS 측정 중")
                .setContentText("화면이 꺼져 있어도 위치를 수집해요. 완료하면 종료해 주세요.")
                .setContentIntent(content).setOngoing(true).setOnlyAlertOnce(true)
                .addAction(android.R.drawable.ic_media_pause, "측정 종료", stop).build();
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(NOTIFICATION, notification);
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) throw new SecurityException();
            if (locations == null || !locations.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                finish("기기의 위치 기능을 켠 뒤 다시 시작해 주세요."); return START_NOT_STICKY;
            }
            collecting = true;
            locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000, 3, this, Looper.getMainLooper());
            handler.post(heartbeat);
        } catch (RuntimeException exception) { finish("위치 측정을 시작하지 못했어요. 정확한 위치 권한과 기기 설정을 확인해 주세요."); }
        return START_NOT_STICKY;
    }
    @Override public void onLocationChanged(Location location) {
        if (!collecting || !store.owns(sessionId)) return;
        try {
            if (store.limitReached()) { finish("측정 한도에 도달해 종료했어요."); return; }
            store.accept(location);
            if (store.limitReached()) finish("측정 한도에 도달해 종료했어요.");
        } catch (RuntimeException exception) { finish("기기에 기록을 보관하지 못해 측정을 종료했어요."); }
    }
    @Override public void onProviderDisabled(String provider) { if (LocationManager.GPS_PROVIDER.equals(provider)) finish("기기의 위치 기능이 꺼져 측정을 종료했어요."); }
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
    private void cleanup() {
        collecting = false; handler.removeCallbacksAndMessages(null);
        if (locations != null) { try { locations.removeUpdates(this); } catch (RuntimeException ignored) {} }
        stopForeground(STOP_FOREGROUND_REMOVE);
    }
    private void finish(String message) {
        cleanup();
        try { if (store.owns(sessionId)) store.finish(message); } catch (RuntimeException ignored) { /* Prior atomic checkpoint remains recoverable. */ }
        stopSelf();
    }
    @Override public void onDestroy() {
        cleanup();
        try { if (store.owns(sessionId)) store.finish("측정 서비스가 종료됐어요. 기록을 확인하고 저장해 주세요."); } catch (RuntimeException ignored) {}
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
