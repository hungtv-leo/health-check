import { env } from '../../src/config';
import { cmsFlow } from './flow';

cmsFlow(
  'HC-CMS2',
  'CMS2',
  () => ({ baseUrl: env.cms2BaseUrl, user: env.cms2User, pass: env.cms2Pass }),
  () => Boolean(env.cms2User && env.cms2Pass),
);
