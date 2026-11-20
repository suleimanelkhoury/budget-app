/**
 * English resources — assembled per area.
 *
 * Each area file is owned by the page(s) it serves; keys are grouped by
 * feature (nav, auth, calculator, …) so pages can be translated
 * independently.
 */

import common from './common';
import nav from './nav';
import auth from './auth';
import settings from './settings';
import calculator from './calculator';
import dashboard from './dashboard';
import charts from './charts';
import detail from './detail';

const en = {
  common,
  nav,
  auth,
  settings,
  calculator,
  dashboard,
  charts,
  detail,
};

export default en;
