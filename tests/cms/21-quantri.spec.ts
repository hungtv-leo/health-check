import { env } from '../../src/config';
import { cmsFlow } from './flow';

cmsFlow(
  'HC-QT',
  'Quản trị',
  () => ({ baseUrl: env.qtBaseUrl, user: env.qtUser, pass: env.qtPass }),
  () => Boolean(env.qtUser && env.qtPass),
);
