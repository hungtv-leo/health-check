import { env } from '../../src/config';
import { checkStrapiMenus, loginStrapi, logoutStrapi } from '../../src/pages/cms-apps';
import { cmsFlow } from './flow';

cmsFlow(
  'HC-ADMVNMF',
  'Admin vnmf',
  () => ({ baseUrl: env.admVnmfBaseUrl, user: env.admVnmfUser, pass: env.admVnmfPass }),
  () => Boolean(env.admVnmfUser && env.admVnmfPass),
  {
    login: loginStrapi,
    checkMenus: checkStrapiMenus,
    logout: (page) => logoutStrapi(page),
  },
);
