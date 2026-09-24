import { env } from '../../src/config';
import { checkCmsNewsMenus, loginCmsNews, logoutCmsNews } from '../../src/pages/cms-apps';
import { cmsFlow } from './flow';

cmsFlow(
  'HC-CMSNEW',
  'Cms new',
  () => ({ baseUrl: env.cmsNewBaseUrl, user: env.cmsNewUser, pass: env.cmsNewPass }),
  () => Boolean(env.cmsNewUser && env.cmsNewPass),
  {
    login: loginCmsNews,
    checkMenus: checkCmsNewsMenus,
    logout: logoutCmsNews,
  },
);
