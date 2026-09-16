# Auth background photographs

- File: `auth-runner.jpg`
- Photographer: RUN 4 FFWPU
- Source: https://www.pexels.com/photo/man-in-black-sportswear-running-on-track-field-5997871/
- Download: https://images.pexels.com/photos/5997871/pexels-photo-5997871.jpeg?auto=compress&h=1500&w=1100
- License: https://www.pexels.com/license/ (checked 2026-09-09)
- Pexels permits website use and modification; attribution is optional. Do not imply endorsement by the depicted person or clothing brands. This is illustrative stock imagery, not a CrewFit member testimonial or partner image.

## Additional photos (same Pexels license, checked 2026-09-09)

| File | Photographer | Source |
| --- | --- | --- |
| `auth-gym.jpg` | Abdulrhman Alkady | https://www.pexels.com/photo/a-man-working-out-with-a-kettlebell-4976933/ |
| `auth-city-run.jpg` | Ketut Subiyanto | https://www.pexels.com/photo/a-woman-running-in-a-city-5036905/ |
| `auth-strength.jpg` | krishna agrawal | https://www.pexels.com/photo/woman-exercising-with-dumbbells-24244667/ |
| `auth-cycling.jpg` | RUN 4 FFWPU | https://www.pexels.com/photo/man-in-black-helmet-riding-bicycle-on-road-5735770/ |

Downloads:

- https://images.pexels.com/photos/4976933/pexels-photo-4976933.jpeg?auto=compress&w=1100&h=1500
- https://images.pexels.com/photos/5036905/pexels-photo-5036905.jpeg?auto=compress&w=1100&h=1500
- https://images.pexels.com/photos/24244667/pexels-photo-24244667.jpeg?auto=compress&w=1100&h=1500
- https://images.pexels.com/photos/5735770/pexels-photo-5735770.jpeg?auto=compress&w=1100&h=1500

These photos are copyrighted, not public-domain images. Free use is under the Pexels license; it is not a guarantee that every possible use of a depicted person, logo, or trademark is cleared. Keep them as illustrative exercise backgrounds, not endorsements, testimonials, or CrewFit member portraits. Recheck rights if the use changes (e.g. advertising a partnership).

## Display rules

The local photographs are mounted only at widths of 960px and above. CSS applies grayscale, 65% image opacity, and a dark gradient strongest behind the logo and bottom copy. Keep each exercise visible; do not add track-line graphics or extra cards over it. Mobile keeps the logo and form without requesting photographs.

Choose a random starting photo once per auth layout mount, excluding the previous opening photo stored in the same tab's `sessionStorage` (`crewfit.auth.start-photo`). Storage denial falls back to unrestricted random selection. Resizing, typing, and pause/resume do not reroll the start. Mobile-only visits do not write the stored opening photo.

From that starting point, the circular order is track running → kettlebell training → city running → dumbbell training → cycling. Advance every 8 seconds with a 1.2-second opacity fade; only successfully loaded images participate. A visible pause/resume button controls autoplay. Reduced-motion preferences disable autoplay and transitions. Hidden tabs and mobile layouts stop the timer. Headline and form do not rotate or move.
