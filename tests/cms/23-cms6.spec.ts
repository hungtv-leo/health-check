import { env } from '../../src/config';
import { checkCms6Menus, loginSso, logoutCms6 } from '../../src/pages/cms-apps';
import { cmsFlow } from './flow';

cmsFlow(
  'HC-CMS6',
  'CMS6',
  () => ({ baseUrl: env.cms6BaseUrl, user: env.cms6User, pass: env.cms6Pass }),
  () => Boolean(env.cms6User && env.cms6Pass),
  {
    login: loginSso,
    checkMenus: checkCms6Menus,
    logout: (page) => logoutCms6(page),
  },
  300_000,
);
