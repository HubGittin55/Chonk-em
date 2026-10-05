'use strict';
/* Level data. kind: 'snack' | 'veggie' | 'power'. content keys must exist in CONTENT (barrels.js). */

const LEVELS = [
  {
    name: 'First Breakfast',
    balls: 10,
    goal: 8, // calories to win
    funnel: { cx: 300, range: 120, speed: 0.9, half: 48, y: 636 },
    barrels: [
      { x: 150, y: 220, kind: 'snack',  content: 'kibble'   },
      { x: 300, y: 200, kind: 'snack',  content: 'salmon'   },
      { x: 450, y: 220, kind: 'snack',  content: 'kibble'   },
      { x: 110, y: 330, kind: 'veggie', content: 'broccoli' },
      { x: 235, y: 335, kind: 'snack',  content: 'tuna'     },
      { x: 365, y: 335, kind: 'snack',  content: 'salmon'   },
      { x: 495, y: 330, kind: 'veggie', content: 'celery'   },
      { x: 180, y: 445, kind: 'snack',  content: 'salmon'   },
      { x: 62,  y: 445, kind: 'power',  content: 'wide'     },
      { x: 538, y: 445, kind: 'power',  content: 'multi'    },
      { x: 300, y: 460, kind: 'snack',  content: 'kibble'   },
      { x: 420, y: 445, kind: 'veggie', content: 'broccoli' },
      { x: 300, y: 550, kind: 'snack',  content: 'tuna'     },
    ],
  },
];
