package com.crewfit.app;

/** Same acceptance rules and units as features/tracking/tracking.js. */
final class TrackingMath {
    static final long MAX_MS = 21600000;
    static final int MAX_POINTS = 10000;
    static boolean sport(String sport) { return "walking".equals(sport) || "running".equals(sport) || "cycling".equals(sport); }
    static double acceptedDistance(double lat, double lng, long time, double accuracy, double[] previous, String sport, long now) {
        if (!sport(sport) || !Double.isFinite(lat) || !Double.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || time <= 0
                || !Double.isFinite(accuracy) || accuracy < 0 || accuracy > 50 || now - time > 20000 || time > now + 2000) return -1;
        if (previous == null) return 0;
        double dt = time - previous[2];
        if (dt <= 0) return -1;
        double a = Math.toRadians(lat - previous[0]), b = Math.toRadians(lng - previous[1]);
        double h = Math.pow(Math.sin(a / 2), 2) + Math.cos(Math.toRadians(previous[0])) * Math.cos(Math.toRadians(lat)) * Math.pow(Math.sin(b / 2), 2);
        double distance = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
        if (dt > 30000) return 0;
        double limit = "walking".equals(sport) ? 6 : "running".equals(sport) ? 12 : 35;
        return distance / (dt / 1000) > limit || distance < 3 ? -1 : distance;
    }
}
