package com.crewfit.app;

import android.content.Context;
import android.os.SystemClock;
import android.util.AtomicFile;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/** Process-local owner lock plus atomic, private recovery file. No automatic restart. */
final class TrackingStore {
    private static TrackingStore instance;
    static synchronized TrackingStore get(Context context) {
        if (instance == null) instance = new TrackingStore(context.getApplicationContext());
        return instance;
    }
    private final AtomicFile file;
    private JSObject state = idle();
    private String owner = "";
    private long started = -1;
    private boolean storageFailed;
    private TrackingStore(Context context) {
        file = new AtomicFile(new File(context.getNoBackupFilesDir(), "gps-session.json"));
        if (!file.getBaseFile().exists()) return;
        try {
            JSObject saved = new JSObject(new String(file.readFully(), StandardCharsets.UTF_8));
            owner = saved.getString("ownerId", "");
            state = new JSObject(saved.getJSONObject("state").toString());
            if (active()) {
                state.put("status", "done");
                state.put("message", "앱이 중단되어 측정을 종료했어요. 복구한 기록을 확인하고 저장해 주세요.");
                persist();
            }
        } catch (Exception exception) { storageFailed = true; }
    }
    private static JSObject idle() {
        return new JSObject().put("status", "idle").put("sessionId", "").put("sport", "running")
            .put("points", new JSONArray()).put("elapsed", 0).put("distance", 0).put("message", "").put("awake", false);
    }
    synchronized void guard(String user) {
        if (user == null || user.trim().isEmpty() || user.length() > 128) throw new IllegalStateException("INVALID_OWNER");
        if (storageFailed) throw new IllegalStateException("STORAGE_ERROR");
        if (!owner.isEmpty() && !owner.equals(user)) throw new IllegalStateException("OWNER_MISMATCH");
    }
    synchronized boolean active() { return "waiting".equals(state.getString("status")) || "running".equals(state.getString("status")); }
    synchronized String sessionId() { return state.getString("sessionId", ""); }
    synchronized boolean owns(String session) { return session != null && session.equals(sessionId()); }
    synchronized boolean begin(String user, String session, String sport) {
        guard(user);
        if (session == null || !session.matches("[a-zA-Z0-9-]{16,80}") || !TrackingMath.sport(sport)) throw new IllegalStateException("INVALID_SESSION");
        if (!state.getString("sessionId", "").isEmpty()) {
            if (session.equals(state.getString("sessionId"))) return false;
            throw new IllegalStateException("SESSION_EXISTS");
        }
        owner = user; state = idle(); started = -1;
        state.put("sessionId", session).put("sport", sport).put("status", "waiting").put("message", "정확한 위치를 기다리고 있어요.");
        try { persist(); } catch (RuntimeException exception) { state.put("status", "done"); throw exception; }
        return true;
    }
    synchronized JSObject snapshot(String user) {
        return snapshot(user, false);
    }
    synchronized JSObject snapshot(String user, boolean summaryOnly) {
        guard(user); elapsed();
        try {
            if (!summaryOnly) return new JSObject(state.toString());
            return new JSObject(state, new String[]{"status", "sessionId", "sport", "elapsed", "distance", "message", "awake"});
        } catch (Exception exception) { throw new IllegalStateException("STORAGE_ERROR"); }
    }
    synchronized void elapsed() {
        if (active() && started >= 0) state.put("elapsed", Math.min(TrackingMath.MAX_MS, Math.max(0, SystemClock.elapsedRealtime() - started)));
    }
    synchronized boolean limitReached() { elapsed(); return state.optLong("elapsed") >= TrackingMath.MAX_MS || state.optJSONArray("points").length() >= TrackingMath.MAX_POINTS; }
    synchronized void accept(android.location.Location location) {
        if (!active()) return;
        JSONArray points = state.optJSONArray("points");
        JSONArray last = points.optJSONArray(points.length() - 1);
        double[] previous = last == null ? null : new double[]{last.optDouble(0), last.optDouble(1), last.optDouble(2)};
        double delta = TrackingMath.acceptedDistance(location.getLatitude(), location.getLongitude(), location.getTime(),
            location.hasAccuracy() ? location.getAccuracy() : Double.NaN, previous, state.getString("sport"), System.currentTimeMillis());
        if (delta < 0) return;
        if (started < 0) started = SystemClock.elapsedRealtime();
        points.put(new JSONArray(java.util.Arrays.asList(location.getLatitude(), location.getLongitude(), location.getTime())));
        state.put("distance", state.optDouble("distance") + delta).put("status", "running").put("message", "GPS 수집 중");
        elapsed(); persist();
    }
    synchronized void checkpoint() { if (active()) { elapsed(); persist(); } }
    synchronized void finish(String message) {
        if (!active()) return;
        elapsed(); started = -1; state.put("status", "done").put("message", message); persist();
    }
    synchronized void clear(String user, String session) {
        guard(user);
        if (active()) throw new IllegalStateException("SESSION_ACTIVE");
        if (session == null || !session.equals(state.getString("sessionId"))) throw new IllegalStateException("SESSION_MISMATCH");
        file.delete();
        if (file.getBaseFile().exists()) throw new IllegalStateException("STORAGE_ERROR");
        owner = ""; state = idle(); started = -1;
    }
    private void persist() {
        FileOutputStream stream = null;
        try {
            stream = file.startWrite();
            stream.write(new JSObject().put("ownerId", owner).put("state", state).toString().getBytes(StandardCharsets.UTF_8));
            file.finishWrite(stream);
        } catch (Exception exception) {
            if (stream != null) file.failWrite(stream);
            throw new IllegalStateException("STORAGE_ERROR");
        }
    }
}
