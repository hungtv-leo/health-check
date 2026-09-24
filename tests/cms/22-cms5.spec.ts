import { env } from '../../src/config';
import { checkCms5Menus, loginSso, logoutCms5 } from '../../src/pages/cms-apps';
import { cmsFlow } from './flow';

cmsFlow(
  'HC-CMS5',
  'CMS5',
  () => ({ baseUrl: env.cms5BaseUrl, user: env.cms5User, pass: env.cms5Pass }),
  () => Boolean(env.cms5User && env.cms5Pass),
  {
    login: loginSso,
    checkMenus: checkCms5Menus,
    logout: logoutCms5,
  },
);
