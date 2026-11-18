package com.crewfit.app;

/** Identity token prevents a late permission result from restarting a signed-out session. Main-thread only. */
final class PendingTrackingStart<T> {
    private T current;
    private boolean ready;
    boolean begin(T call) { if (current != null) return false; current = call; ready = false; return true; }
    boolean owns(T call) { return call != null && current == call; }
    T current() { return current; }
    boolean ready(T call) { if (!owns(call)) return false; ready = true; return true; }
    T readyCall() { return ready ? current : null; }
    T cancel() { T old = current; current = null; ready = false; return old; }
    void complete(T call) { if (owns(call)) cancel(); }
}
