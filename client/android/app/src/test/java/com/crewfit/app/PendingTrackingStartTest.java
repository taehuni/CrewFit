package com.crewfit.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class PendingTrackingStartTest {
    @Test public void suspendDuringPermissionPromptIgnoresLateGrant() {
        PendingTrackingStart<Object> pending = new PendingTrackingStart<>();
        Object oldCall = new Object();
        assertTrue(pending.begin(oldCall));
        assertSame(oldCall, pending.cancel());
        assertFalse(pending.ready(oldCall));
        assertNull(pending.readyCall());
    }
    @Test public void oldPermissionCallbackCannotCancelOrStartNewOwner() {
        PendingTrackingStart<Object> pending = new PendingTrackingStart<>();
        Object oldCall = new Object(), newCall = new Object();
        pending.begin(oldCall); pending.cancel(); pending.begin(newCall);
        assertFalse(pending.ready(oldCall));
        pending.complete(oldCall);
        assertTrue(pending.owns(newCall));
        assertTrue(pending.ready(newCall));
        assertSame(newCall, pending.readyCall());
    }
    @Test public void onlyOnePromptCanBePendingAndResumeStartsOnlyReadyCall() {
        PendingTrackingStart<Object> pending = new PendingTrackingStart<>();
        Object call = new Object();
        assertTrue(pending.begin(call));
        assertFalse(pending.begin(new Object()));
        assertNull(pending.readyCall());
        pending.ready(call); pending.complete(call);
        assertNull(pending.readyCall());
    }
}
