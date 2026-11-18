package com.crewfit.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class TrackingMathTest {
    private final long now = 1700000000000L;
    @Test public void rejectsInaccurateStaleAndFutureFixes() {
        assertEquals(-1, TrackingMath.acceptedDistance(37, 127, now, 51, null, "running", now), 0);
        assertEquals(-1, TrackingMath.acceptedDistance(37, 127, now - 20001, 10, null, "running", now), 0);
        assertEquals(-1, TrackingMath.acceptedDistance(37, 127, now + 2001, 10, null, "running", now), 0);
        assertEquals(-1, TrackingMath.acceptedDistance(Double.NaN, 127, now, 10, null, "running", now), 0);
        assertEquals(0, TrackingMath.acceptedDistance(37, 127, now, 50, null, "running", now), 0);
    }
    @Test public void appliesSportSpeedAndJitterFilters() {
        double[] previous = {37, 127, now - 1000};
        assertEquals(-1, TrackingMath.acceptedDistance(37.00001, 127, now, 10, previous, "running", now), 0);
        assertEquals(-1, TrackingMath.acceptedDistance(37.00009, 127, now, 10, previous, "walking", now), 0);
        assertTrue(TrackingMath.acceptedDistance(37.00009, 127, now, 10, previous, "running", now) > 9);
        assertEquals(-1, TrackingMath.acceptedDistance(37.0002, 127, now, 10, previous, "running", now), 0);
        assertTrue(TrackingMath.acceptedDistance(37.0002, 127, now, 10, previous, "cycling", now) > 20);
    }
    @Test public void breaksLongGapsWithoutAddingDistance() {
        assertEquals(0, TrackingMath.acceptedDistance(38, 128, now, 10, new double[]{37,127,now-30001}, "walking", now), 0);
        assertEquals(-1, TrackingMath.acceptedDistance(38, 128, now, 10, new double[]{37,127,now-30000}, "walking", now), 0);
        assertEquals(-1, TrackingMath.acceptedDistance(37,127,now,10,new double[]{37,127,now},"running",now),0);
    }
}
