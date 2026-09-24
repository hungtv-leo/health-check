import { env } from '../../src/config';
import { checkNoiboMenus, loginNoibo, logoutNoibo } from '../../src/pages/cms-apps';
import { cmsFlow } from './flow';

cmsFlow(
  'HC-NOIBO',
  'Nội bộ',
  () => ({ baseUrl: env.noiboBaseUrl, user: env.noiboUser, pass: env.noiboPass }),
  () => Boolean(env.noiboUser && env.noiboPass),
  {
    login: loginNoibo,
    checkMenus: checkNoiboMenus,
    logout: logoutNoibo,
  },
  240_000,
);
