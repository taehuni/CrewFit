# Camera movement feedback

MediaPipe Pose Landmarker 1.2.0 estimates landmarks locally. `exerciseAnalysis.js`
selects an exercise-specific geometry and observation engine. Measurement runs
locally; model and WASM downloads use Google Storage and jsDelivr. The default
flow recognizes a movement before starting feedback. It sends four images to
OpenAI only after the user explicitly agrees and starts that recognition.

## Supported scope

| Exercise/view | Observations | Excluded |
| --- | --- | --- |
| Bodyweight squat, side | Knee angle, repetitions, heel-rise signal, torso lean change | Spinal curvature, knee rotation, foot pressure |
| Bodyweight squat, front | Each knee's inward displacement relative to its starting hip-to-ankle line | Depth, repetitions, actual joint rotation |
| Stationary lunge, side | Selected front leg angle/repetitions, heel/torso changes | Walking/alternating lunges, full-body safety |
| Floor push-up, side | Elbow angle/repetitions, hip displacement from shoulder-to-ankle line | Kneeling/incline variants, elbow flare, hand pressure |

## Interpretation

The exercise principles are informed by NASM squat biomechanics and push-up
guidance, and ACE's lunge guidance. These sources do **not** validate our numeric
detector thresholds. Camera-based thresholds are product heuristics, not clinical
cutoffs, scores, a diagnosis, or proof of correct/safe form.

- https://www.nasm.org/resource-center/blog/training/biomechanics-of-the-squat
- https://www.nasm.org/resource-center/exercise-library/push-up
- https://www.acefitness.org/resources/everyone/exercise-library/94/forward-lunge/

Calibration requires 12 consecutive eligible observations. A movement signal must
persist for 5 observations; unreliable landmarks, changed side, or time gaps reset
calibration. Front view suppresses angle and repetition UI entirely. Other views
count only after calibration. Before a measurement starts, manual selection can
change the exercise while keeping the camera open. During a measurement the
exercise and view stay fixed. Session summaries retain detected signals, never label a silent
session as correct form.

## Legacy local preparation recognizer

`startPoseRecognition.js` and its synthetic tests remain as a local starting-pose
helper, but the current screen does not expose it as automatic movement recognition.
An upright stance is not evidence of a squat. The primary flow uses the consented
movement classifier below; direct exercise selection is only a fallback.

## AI exercise classification contract

The consent-based AI flow uses OpenAI Decisions (`POST /v1/decisions`,
`gpt-6-luna`) to choose among named movement categories, with `other` and
`unknown` fallbacks. This is classification, not posture scoring or a universal
exercise evaluator. A catalog entry alone does not implement its measurement
rules. Only the three supported exercise variants above can proceed to measurement.

After consent, the client samples four JPEG frames over about three seconds,
resized to at most 512 pixels on their longest edge. It sends them to the
signed-in CrewFit API, which forwards them to OpenAI. No audio is captured.
CrewFit does not persist these frames in its database or log them. Provider-side
retention is governed by the OpenAI account's data controls; this feature does not
promise zero retention by OpenAI. Keep request-body logging disabled for this route
in any proxy, monitoring, or deployment configuration.

Classification needs the existing server-only `OPENAI_API_KEY` and access to
Decisions. It incurs API usage charges and does not reuse the coaching model
setting. Failure or missing access shows a retryable recognition error; the server
does not substitute a guessed exercise or tell the user to select one manually.
The server validates authentication, explicit consent, four bounded JPEG inputs,
and applies per-user rate/concurrency limits and a provider timeout. It never
accepts remote image URLs. Raw provider errors are not exposed to the client.
Limits are held in server-process memory (2 requests/minute, 20/rolling day,
one concurrent request/user). Restarts reset them; multiple server instances need
a shared limiter before these limits can serve as a deployment-wide cost cap.

Low confidence, ambiguous movement, refusals and unsupported variants must not
start a measurement. Probability thresholds are provisional product settings,
not validated accuracy percentages. The server response is
`{exercise,label,supported,selection,reason}`. `selection` is null unless exercise,
standard variant, actual movement evidence and measurement configuration all pass
independent gates. Supported configurations are squat/front, squat/side,
lunge/left, lunge/right and pushup/side. Lunge left/right is the anatomical forward
leg, never image left/right. Direction probability and confidence must both reach
0.95, exercise both 0.8, and variant/movement predicates 0.9. Each choice must
contain a complete, finite probability distribution; malformed, duplicated or
contradictory answers are rejected. A standing pose does not establish squats.
Occluded feet/joints, oblique views and uncertain anatomical sides require a new
capture rather than a default evaluator. These gates are not an accuracy claim.
Measurement keeps the accepted configuration fixed. Stopping the camera, changing account/mode or leaving
invalidates the request; cancellation cannot retract images already transmitted.

Before rollout, use consented, labeled clips to check supported and unsupported
variants, static poses, occlusion, multiple people, network failures, and late
responses after cancellation. Mock API tests verify contracts and safeguards;
they do not establish provider availability or real-world recognition accuracy.

Official API contract: https://developers.openai.com/api/docs/guides/decisions

## Summary storage and privacy

Saving is explicit after a measurement ends. The browser creates one stable UUID
for the measurement and keeps it for retries; a duplicate insert reads the user's
existing row instead of changing it. Starting another measurement creates a new
ID. Camera preview without a started measurement is not a saved session.

`poseSessions.js` writes directly to Supabase `pose_sessions` using the signed-in
user and RLS. It stores only the date (KST), exercise, view, repetitions (null for
front squat), elapsed seconds, and bounded observation text (`key`, `label`,
`message`). The database also stores the owner ID and creation timestamp. Images,
videos, landmarks, frame-by-frame angles and camera settings are not stored. These
records are separate from general workout logs and do not add workout statistics.
An empty observation list means no persistent signal was recorded, not correct
form or a successful safety assessment.

The helpers validate exercise/view combinations, real dates, integer limits and
observation keys. `savePoseSession` requires the measurement owner's
`expectedUserId`; history requests also pass `expectedUserId` to prevent results
from being cached under another account after an account switch. The database
allows authenticated users to select and insert their own rows only; normal
clients cannot update or delete summaries. Failed saves remain retryable in the
current page. Unsaved results are not persisted locally across reloads.

## Database setup and storage verification

Review `server/config/20261104_pose_sessions.sql` and apply it manually to a
separate development Supabase project first. It adds the table, validation
function, index, column grants and owner-only RLS policies in a transaction.
Do not use `server/config/schema.sql` as a migration: it can reset existing data.
The application does not apply this migration automatically. Until the migration
is applied, saving and loading history report database errors.

Storage unit tests: `node --test client/src/features/pose/poseSessions.test.js`.
They use mocked Supabase calls and do not establish PostgreSQL or RLS correctness.
Before enabling saved history in a deployment, verify in the development project:

- Save each supported exercise/view and reload history; front squat has no count.
- Retry the same ID after a lost response; exactly one row remains unchanged.
- Use two test accounts and an anonymous client: another owner's rows cannot be
  read or inserted, and updates/deletes and caller-supplied `created_at` fail.
- Reject invalid dates, unsupported exercise/view combinations, non-front null
  counts, negative/out-of-range values, unknown JSON fields, duplicate observation
  keys, wrong-mode observations and JSON nulls (including nested null values).
- Switch accounts during save/history loading and check the displayed account's
  history remains isolated. Verify network failures and the unapplied-migration
  state produce a visible retryable error.
- Check the history and result cards at desktop and mobile widths, and separately
  verify camera permission, model loading, physical camera shutdown and timing on
  real devices.

## Validation still required before accuracy claims

Unit tests use synthetic geometry, including mirrored direction, wrong views,
occlusion, tracking gaps, threshold jitter and wrong lunge-leg selection. They
verify logic, not real-world model accuracy.

Before describing the feature as validated, obtain consented clips across body
proportions, clothing, lighting, camera heights and both sides. Have an exercise
professional label observable events independently. Compare false-positive and
miss rates for each mode, including clips that should be rejected. Hold out clips
from threshold tuning. Verify physical camera stop, model loading and performance
on Android/iOS and desktop separately. Never substitute a synthetic test pass for
these checks.

## Preparation and measurement flow

The initial screen asks for camera preparation, not an exercise. After the user
consents to four-image transmission and starts recognition, a cancellable five-second
countdown precedes four frames sampled over roughly three seconds. A supported,
confident server selection supplies both exercise and camera view. The client
validates that pair against its evaluator allowlist; missing/mismatched/unsupported
pairs never silently become squat or side view. Lunge left/right must be supplied
by the server, not guessed or selected by the user.

After a valid selection, a cancellable three-second baseline preparation begins
automatically, then measurement starts with no confirmation click. Local baseline
validity and minimum valid frames remain required for observations and saving.
Uncertain/unsupported results stay in the camera screen with retry and direct
selection fallback. Each retry requires fresh consent; there is no background or
continuous AI upload. Cancellation cannot retract an already transmitted request.

During measurement the exercise and view stay fixed. The user ends the current
measurement before recognizing another movement, with a result/save step and an
unsaved-result confirmation before replacement. Each run creates a separate ID.
Stopping the camera, hiding the page, changing account or disposal invalidates
pending countdown/capture/responses. Owner and camera-generation checks run after
both waits. Temporary captured frames are released after the response.

The camera, repetitions (or front-view observation), one feedback message and a
large finish button take priority. Detailed observations appear in results.
Countdown tests use a fake clock; selection tests reject unsupported or ambiguous
pairs. Real camera, framing, model classification, accessibility announcements,
and mobile performance still require physical-device testing.

## Optional private video replay

Video capture is a separate opt-in checkbox, off for every new measurement.
The recorder starts at measurement activation (not recognition photos/countdown),
uses video tracks only, and stops at 120 seconds without stopping the camera or
pose inference. Early finish finalizes a shorter clip. A 32 MiB cap discards an
oversized clip; unsupported recording never blocks pose feedback.
Clips remain in memory until the user saves the summary and explicitly chooses
video storage. Upload failure preserves that summary; retry checks for existing
video first. Account change, replacement and unmount discard local clip state.
History requests a short-lived private playback link on demand. Videos remain
private and stored until the owner explicitly deletes them; there is no automatic
retention deadline. Signed playback links expire independently and can be refreshed.
Unit tests cover the timer, early finish, disposal, size cap and unsupported API.
Real Android/WebView encoding and physical camera capture remain device checks.

## Catalog and custom exercise observation

`/pose?view=manual` offers catalog search and free-text exercise names. Existing
three local exercises retain their deterministic landmark flow. Source-backed
catalog exercises use `/pose/feedback` only after a separate repeated-photo
consent: four frames, at least 35 seconds between attempts, no overlapping call.
Failures, exercise mismatch and quota limits pause automatic requests while the
camera/time recording remains available. Explicit retry resumes the gate.
Custom names/pending entries are record-only (name/time), never sent as criteria.
Catalog sessions have no repetition count, no local squat fallback, and only
observable-item feedback. These are limited visual observations, not safety or
normal-form certification. Summary saving stays independent of video upload.
