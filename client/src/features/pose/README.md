# Camera movement feedback

MediaPipe Pose Landmarker 1.2.0 estimates landmarks locally. `exerciseAnalysis.js`
selects an exercise-specific geometry and observation engine. Camera frames are not
uploaded or stored; model and WASM downloads use Google Storage and jsDelivr.

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
count only after calibration. Mode changes clear results and require the camera to
be stopped. Session summaries retain detected signals, never label a silent
session as correct form.

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
